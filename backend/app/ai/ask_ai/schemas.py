from pydantic import BaseModel, Field


class AskAIRequest(BaseModel):
    question: str = Field(min_length=1)


class AskAIResponse(BaseModel):
    answer: str
    agent: str
    capabilities_used: list[str]
    context: dict
    requires_human_validation: bool = False
    action_result: dict | None = None
