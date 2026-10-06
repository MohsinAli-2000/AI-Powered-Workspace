import json
import logging
import time
from typing import Optional
import pika
from pika.exceptions import AMQPConnectionError, AMQPChannelError

from src.config import settings
from src.processor import processor

logger = logging.getLogger(__name__)


class QueueConsumer:
    def __init__(self):
        self.rabbitmq_url = settings.RABBITMQ_URL
        self.queue_name = settings.QUEUE_NAME
        self.dlq_name = f"{self.queue_name}-dlq"
        self.connection: Optional[pika.BlockingConnection] = None
        self.channel: Optional[pika.adapters.blocking_connection.BlockingChannel] = None
        self._is_stopping = False

    def connect(self):
        """Establishes connection and sets up queues with DLQ dead-lettering."""
        logger.info(f"Connecting to RabbitMQ at {self.rabbitmq_url}...")
        params = pika.URLParameters(self.rabbitmq_url)
        params.heartbeat = 300
        params.blocked_connection_timeout = 300
        self.connection = pika.BlockingConnection(params)
        self.channel = self.connection.channel()

        # 1. Declare Dead Letter Queue & Exchange
        dlx_exchange = f"{self.queue_name}-dlx"
        self.channel.exchange_declare(exchange=dlx_exchange, exchange_type="direct", durable=True)
        self.channel.queue_declare(queue=self.dlq_name, durable=True)
        self.channel.queue_bind(exchange=dlx_exchange, queue=self.dlq_name, routing_key=self.dlq_name)

        # 2. Declare Main Queue with Dead Letter routing
        queue_args = {
            "x-dead-letter-exchange": dlx_exchange,
            "x-dead-letter-routing-key": self.dlq_name,
        }
        self.channel.queue_declare(queue=self.queue_name, durable=True, arguments=queue_args)

        # 3. Fair dispatch: 1 message per worker at a time
        self.channel.basic_qos(prefetch_count=1)
        logger.info(f"Connected to RabbitMQ. Ready to consume from '{self.queue_name}'.")

    def _on_message(self, ch, method, properties, body):
        """Callback executed when a message is received from RabbitMQ."""
        delivery_tag = method.delivery_tag
        try:
            logger.info(f"Received message: delivery_tag={delivery_tag}")
            raw_payload = body.decode("utf-8")
            data = json.loads(raw_payload)

            # Validate job_type if present
            job_type = data.get("job_type")
            if job_type and job_type != "PROCESS_DOCUMENT":
                logger.warning(
                    f"Rejecting unrecognized job_type '{job_type}' (delivery_tag={delivery_tag}) to DLQ."
                )
                ch.basic_nack(delivery_tag=delivery_tag, requeue=False)
                return

            # Support both { "document_version_id": "..." } and { "version_id": "..." }
            version_id = data.get("document_version_id") or data.get("version_id") or data.get("id")

            if not version_id:
                logger.error(f"Malformed message payload (no version_id found): {raw_payload}")
                ch.basic_nack(delivery_tag=delivery_tag, requeue=False)
                return

            # Process document version
            result = processor.process_version(version_id)
            if result.get("skipped"):
                logger.info(f"Version {version_id} was already being processed; skipped duplicate.")
            else:
                chunks_count = result.get("chunks_count", 0)
                logger.info(f"Successfully processed version {version_id}: {chunks_count} chunks.")

            # Acknowledge success
            ch.basic_ack(delivery_tag=delivery_tag)

        except json.JSONDecodeError as err:
            logger.error(f"Invalid JSON payload: {err}. Routing to DLQ.")
            ch.basic_nack(delivery_tag=delivery_tag, requeue=False)

        except Exception as err:
            logger.error(f"Error processing message: {err}. Rejecting to DLQ.", exc_info=True)
            ch.basic_nack(delivery_tag=delivery_tag, requeue=False)

    def start_consuming(self):
        """Starts the blocking consumer loop with automatic reconnection."""
        while not self._is_stopping:
            try:
                self.connect()
                self.channel.basic_consume(
                    queue=self.queue_name,
                    on_message_callback=self._on_message,
                    auto_ack=False
                )
                logger.info("Worker consumer is active. Waiting for messages. To exit press CTRL+C")
                self.channel.start_consuming()

            except (AMQPConnectionError, AMQPChannelError) as e:
                if self._is_stopping:
                    break
                logger.warning(f"RabbitMQ connection lost ({e}). Retrying in 5 seconds...")
                time.sleep(5)
            except Exception as e:
                if self._is_stopping:
                    break
                logger.error(f"Unexpected error in consumer: {e}. Retrying in 5 seconds...")
                time.sleep(5)

    def _close_internal(self):
        """Internal callback to close channel and connection safely from the loop thread."""
        try:
            if self.channel and self.channel.is_open:
                self.channel.stop_consuming()
            if self.connection and self.connection.is_open:
                self.connection.close()
        except Exception as e:
            logger.warning(f"Error closing RabbitMQ connection: {e}")

    def stop(self):
        """Gracefully shut down consumer thread-safely."""
        logger.info("Stopping QueueConsumer...")
        self._is_stopping = True
        try:
            if self.connection and self.connection.is_open:
                self.connection.add_callback_threadsafe(self._close_internal)
            elif self.channel and self.channel.is_open:
                self.channel.stop_consuming()
        except Exception as e:
            logger.warning(f"Error while requesting consumer stop: {e}")

