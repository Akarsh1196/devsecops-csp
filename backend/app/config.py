from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "OpsDesk API"
    database_url: str = "postgresql+psycopg://opsdesk:opsdesk@localhost:5432/opsdesk"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
