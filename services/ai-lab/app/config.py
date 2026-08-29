from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    pocketqa_llm_model: str = ""
    openai_api_key: SecretStr = SecretStr("")
    pocketqa_env: str = "development"
    pocketqa_log_level: str = "info"


settings = Settings()
