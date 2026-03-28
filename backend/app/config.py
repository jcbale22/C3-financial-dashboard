from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    qbo_client_id: str
    qbo_client_secret: str
    qbo_redirect_uri: str
    qbo_environment: str = "production"
    qbo_company_id: str = ""
    secret_key: str = "change_this"

    # Intuit OAuth endpoints
    intuit_auth_url: str = "https://appcenter.intuit.com/connect/oauth2"
    intuit_token_url: str = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
    intuit_revoke_url: str = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke"

    @property
    def qbo_base_url(self) -> str:
        if self.qbo_environment == "sandbox":
            return "https://sandbox-quickbooks.api.intuit.com/v3/company"
        return "https://quickbooks.api.intuit.com/v3/company"

    class Config:
        env_file = (".env", "../.env")
        env_file_encoding = "utf-8"


settings = Settings()
