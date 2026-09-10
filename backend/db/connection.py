import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()


def get_connection():
    """
    Connect to PostgreSQL using environment variables.
    Never hardcode credentials or log sensitive connection strings.
    """
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        normalized_url = (
            db_url.replace("postgresql+psycopg2://", "postgresql://")
            .replace("postgresql+psycopg://", "postgresql://")
            .replace("postgresql+asyncpg://", "postgresql://")
        )
        return psycopg2.connect(normalized_url, connect_timeout=10)

    host = os.getenv("POSTGRES_HOST", "localhost")
    port = int(os.getenv("POSTGRES_PORT", "5432"))
    dbname = os.getenv("POSTGRES_DB", "postgres")
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "")

    return psycopg2.connect(
        host=host,
        port=port,
        dbname=dbname,
        user=user,
        password=password,
        connect_timeout=10,
    )