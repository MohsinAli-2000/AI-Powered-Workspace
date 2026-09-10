from fastapi import APIRouter
from ..providers import get_llm_provider
from ..schemas import LLMChatRequest, LLMChatResponse

router = APIRouter(prefix="/api/v1/llm", tags=["LLM"])


@router.post("/chat", response_model=LLMChatResponse)
async def chat_completion(body: LLMChatRequest) -> LLMChatResponse:
    """
    Direct LLM completion endpoint for general assistant queries.
    """
    provider = get_llm_provider()
    history_dicts = [{"role": m.role, "content": m.content} for m in body.history]
    content = await provider.generate(
        prompt=body.prompt,
        system_prompt=body.system_prompt,
        history=history_dicts,
    )
    return LLMChatResponse(content=content)
