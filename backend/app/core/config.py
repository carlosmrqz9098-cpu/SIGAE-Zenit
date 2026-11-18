"""Configuración: lee las variables del archivo .env (o de Vercel)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    supabase_url: str
    supabase_publishable_key: str
    supabase_secret_key: str
    database_url: str
    cors_origins: str = "http://localhost:5173"
    storage_bucket: str = "materiales"

    @property
    def lista_cors(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()]

    @property
    def url(self) -> str:
        return self.supabase_url.rstrip("/")


@lru_cache
def get_settings() -> Settings:
    return Settings()
