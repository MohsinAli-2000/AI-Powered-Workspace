import asyncio
from typing import Any, AsyncIterator, Iterable, Optional
from langchain_core.callbacks import AsyncCallbackManagerForLLMRun, CallbackManagerForLLMRun
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    BaseMessage,
    ChatMessage,
    HumanMessage,
    SystemMessage,
)
from langchain_core.outputs import ChatGeneration, ChatGenerationChunk, ChatResult
from pydantic import ConfigDict
from src.providers import get_llm_provider
from src.providers.base import BaseLLMProvider


def history_to_messages(history: Iterable[Any]) -> list[BaseMessage]:
    """
    Converts conversation history (`ConversationMessage` models or `{"role", "content"}` dicts) into
    LangChain messages. `ChatMessage` keeps the caller's exact role string (e.g. "USER", "system"),
    so the provider receives the same history it did before the LangChain migration.
    """
    messages: list[BaseMessage] = []
    for item in history:
        role = item["role"] if isinstance(item, dict) else item.role
        content = item["content"] if isinstance(item, dict) else item.content
        messages.append(ChatMessage(role=role, content=content))
    return messages


def _message_text(message: BaseMessage) -> str:
    # Plain string content is passed through untouched (no stripping/joining).
    return message.content if isinstance(message.content, str) else message.text


def _message_role(message: BaseMessage) -> str:
    if isinstance(message, ChatMessage):
        return message.role
    if isinstance(message, HumanMessage):
        return "user"
    if isinstance(message, AIMessage):
        return "assistant"
    if isinstance(message, SystemMessage):
        return "system"
    return message.type


def messages_to_provider_args(
    messages: list[BaseMessage],
) -> tuple[str, Optional[str], list[dict[str, str]]]:
    """
    Maps a LangChain message list back onto the provider contract:
      * a leading SystemMessage            -> system_prompt
      * the final message                  -> prompt
      * everything in between              -> history (role/content dicts)
    """
    if not messages:
        raise ValueError("ProviderChatModel requires at least one message.")

    remaining = list(messages)
    system_prompt: Optional[str] = None
    if isinstance(remaining[0], SystemMessage):
        system_prompt = _message_text(remaining.pop(0))

    if not remaining:
        raise ValueError("ProviderChatModel requires a final user message after the system prompt.")

    prompt = _message_text(remaining[-1])
    history = [{"role": _message_role(m), "content": _message_text(m)} for m in remaining[:-1]]
    return prompt, system_prompt, history


class ProviderChatModel(BaseChatModel):
    """
    LangChain chat model backed by the configured service provider (Gemini / mock / Ollama).

    All resilience behaviour (retries, backoff, model fallback, sanitized `ServiceError`s) lives in
    the provider and is preserved unchanged; provider exceptions propagate to the caller as-is.
    """

    model_config = ConfigDict(arbitrary_types_allowed=True)

    provider: Optional[BaseLLMProvider] = None

    @property
    def _llm_type(self) -> str:
        return "ai-workspace-provider"

    def _resolve_provider(self) -> BaseLLMProvider:
        return self.provider if self.provider is not None else get_llm_provider()

    async def _agenerate(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        run_manager: Optional[AsyncCallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        prompt, system_prompt, history = messages_to_provider_args(messages)
        text = await self._resolve_provider().generate(
            prompt=prompt,
            system_prompt=system_prompt,
            history=history,
        )
        return ChatResult(generations=[ChatGeneration(message=AIMessage(content=text))])

    async def _astream(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        run_manager: Optional[AsyncCallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> AsyncIterator[ChatGenerationChunk]:
        prompt, system_prompt, history = messages_to_provider_args(messages)
        async for token in self._resolve_provider().generate_stream(
            prompt=prompt,
            system_prompt=system_prompt,
            history=history,
        ):
            chunk = ChatGenerationChunk(message=AIMessageChunk(content=token))
            if run_manager is not None:
                await run_manager.on_llm_new_token(token, chunk=chunk)
            yield chunk

    # The service is fully async; the sync path exists for LangChain tooling used outside an event loop.
    def _generate(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        return asyncio.run(self._agenerate(messages, stop=stop, **kwargs))
