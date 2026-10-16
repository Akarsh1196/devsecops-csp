from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Status = Literal["OPEN", "IN_PROGRESS", "RESOLVED"]
Priority = Literal["LOW", "MEDIUM", "HIGH"]

class IncidentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    priority: Priority = "MEDIUM"
    status: Status = "OPEN"
    assignee: str = "Unassigned"

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("title must not be blank")
        return value


class IncidentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    priority: Priority | None = None
    status: Status | None = None
    assignee: str | None = None

    @model_validator(mode="after")
    def update_must_include_a_field(self):
        if not self.model_fields_set:
            raise ValueError("at least one field is required")
        return self

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("title must not be null")
        value = value.strip()
        if not value:
            raise ValueError("title must not be blank")
        return value

    @field_validator("description", "priority", "status", "assignee")
    @classmethod
    def update_fields_must_not_be_null(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("field must not be null when supplied")
        return value


class IncidentOut(IncidentCreate):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)



class IncidentStatsOut(BaseModel):
    total: int
    open: int
    inProgress: int
    resolved: int
