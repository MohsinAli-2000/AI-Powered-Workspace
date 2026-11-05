import json
from typing import AsyncIterator
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_core.output_parsers import StrOutputParser
from ..errors import ServiceError
from ..langchain_integration import ProviderChatModel, history_to_messages
from ..logger import logger
from ..schemas import LLMChatRequest, LLMChatResponse

router = APIRouter(prefix="/api/v1/llm", tags=["LLM"])

# Chat model -> plain string; the provider is resolved per call, so this is safe to share.
chat_chain = ProviderChatModel() | StrOutputParser()


def _build_messages(body: LLMChatRequest) -> list[BaseMessage]:
    messages: list[BaseMessage] = []
    if body.system_prompt is not None:
        messages.append(SystemMessage(content=body.system_prompt))
    messages.extend(history_to_messages(body.history))
    messages.append(HumanMessage(content=body.prompt))
    return messages


@router.post("/chat", response_model=LLMChatResponse)
async def chat_completion(body: LLMChatRequest) -> LLMChatResponse:
    """
    Direct LLM completion endpoint for general assistant queries.
    """
    content = await chat_chain.ainvoke(_build_messages(body))
    return LLMChatResponse(content=content)


@router.post("/chat/stream")
async def chat_completion_stream(body: LLMChatRequest) -> StreamingResponse:
    """
    Streaming variant of /chat via Server-Sent Events:
      event: token  data: {"token": "..."}    (repeated)
      event: done   data: {}
      event: error  data: {"message": "...", "status_code": 503}
    Headers are sent before the model is called, so failures arrive as `event: error`.
    """
    messages = _build_messages(body)

    async def events() -> AsyncIterator[str]:
        try:
            async for token in chat_chain.astream(messages):
                if token:
                    yield f"event: token\ndata: {json.dumps({'token': token})}\n\n"
            yield "event: done\ndata: {}\n\n"
        except ServiceError as exc:
            logger.error(f"LLM stream failed: {exc.message}")
            payload = {"message": exc.message, "status_code": exc.status_code}
            yield f"event: error\ndata: {json.dumps(payload)}\n\n"
        except Exception as exc:
            logger.error(f"LLM stream failed: {exc!r}", exc_info=True)
            payload = {
                "message": "The AI model failed while generating the answer. Please try again.",
                "status_code": 500,
            }
            yield f"event: error\ndata: {json.dumps(payload)}\n\n"

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )
