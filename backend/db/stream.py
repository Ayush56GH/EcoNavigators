import os
import json
import asyncio
import logging
import random
from datetime import datetime, timezone

import websockets
import psycopg
from dotenv import load_dotenv


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv()

AISSTREAM_API_KEY = os.getenv("AISSTREAM_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

AISSTREAM_URL = "wss://stream.aisstream.io/v0/stream"

MIN_LAT = float(os.getenv("AIS_MIN_LAT", "8"))
MAX_LAT = float(os.getenv("AIS_MAX_LAT", "23"))
MIN_LON = float(os.getenv("AIS_MIN_LON", "76"))
MAX_LON = float(os.getenv("AIS_MAX_LON", "90"))


# ============================================================
# VALIDATION
# ============================================================

if not AISSTREAM_API_KEY:
    raise RuntimeError(
        "AISSTREAM_API_KEY is missing from .env"
    )

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is missing from .env"
    )


# Support common PostgreSQL URL formats
DATABASE_URL = DATABASE_URL.replace(
    "postgresql+psycopg2://",
    "postgresql://"
)

DATABASE_URL = DATABASE_URL.replace(
    "postgresql+psycopg://",
    "postgresql://"
)

DATABASE_URL = DATABASE_URL.replace(
    "postgresql+asyncpg://",
    "postgresql://"
)


# ============================================================
# LOGGING
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)

logger = logging.getLogger("EcoNavigators")


# ============================================================
# DATABASE
# ============================================================

def get_db_connection():
    """
    Create a PostgreSQL connection using DATABASE_URL.
    """

    return psycopg.connect(
        DATABASE_URL,
        connect_timeout=15
    )


def test_database_connection():
    """
    Test connection to the existing Supabase PostgreSQL database.

    IMPORTANT:
    This function does NOT create or modify any tables.
    The database schema is managed separately.
    """

    logger.info("Connecting to Supabase PostgreSQL...")

    with get_db_connection() as conn:

        with conn.cursor() as cur:

            cur.execute("SELECT NOW();")

            db_time = cur.fetchone()[0]

    logger.info(
        "Supabase PostgreSQL connection successful."
    )

    logger.info(
        "Database server time: %s",
        db_time
    )


# ============================================================
# INSERT AIS POSITION
# ============================================================

def insert_position(
    conn,
    mmsi,
    imo,
    ship_name,
    ship_type,
    latitude,
    longitude,
    sog,
    cog,
    heading,
    status,
    ts,
    destination,
    draught,
    source
):
    """
    Insert one AIS position into the EXISTING
    ais_positions table.

    Expected schema:

        id
        mmsi
        imo
        ship_name
        ship_type
        location
        sog
        cog
        heading
        status
        ts
        destination
        draught
        source

    PostGIS location is stored as:

        GEOGRAPHY(Point, 4326)
    """

    with conn.cursor() as cur:

        cur.execute(
            """
            INSERT INTO ais_positions (
                mmsi,
                imo,
                ship_name,
                ship_type,
                location,
                sog,
                cog,
                heading,
                status,
                ts,
                destination,
                draught,
                source
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                ST_SetSRID(
                    ST_MakePoint(%s, %s),
                    4326
                )::geography,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s
            )
            ON CONFLICT (mmsi, ts, location) DO NOTHING;
            """,
            (
                str(mmsi),
                imo,
                ship_name,
                ship_type,
                longitude,
                latitude,
                sog,
                cog,
                heading,
                status,
                ts,
                destination,
                draught,
                source
            )
        )


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def clean_string(value):
    """
    Convert a value into a clean string.

    Returns None for missing/empty values.
    """

    if value is None:
        return None

    value = str(value).strip()

    if not value:
        return None

    return value


def safe_float(value):
    """
    Safely convert a value to float.
    """

    if value is None:
        return None

    try:
        return float(value)

    except (TypeError, ValueError):
        return None


def safe_int(value):
    """
    Safely convert a value to integer.
    """

    if value is None:
        return None

    try:
        return int(value)

    except (TypeError, ValueError):
        return None


# ============================================================
# PARSE POSITION REPORT
# ============================================================

def process_position_report(message, conn):
    """
    Extract a PositionReport from an AISStream message
    and save it into the existing Supabase ais_positions table.
    """

    metadata = message.get(
        "MetaData",
        {}
    )

    message_container = message.get(
        "Message",
        {}
    )

    position = message_container.get(
        "PositionReport",
        {}
    )

    if not position:
        return False


    # ========================================================
    # MMSI
    # ========================================================

    mmsi = position.get(
        "UserID"
    )

    if mmsi is None:
        mmsi = metadata.get(
            "MMSI"
        )

    mmsi = safe_int(mmsi)

    if mmsi is None:

        logger.warning(
            "Position report without valid MMSI."
        )

        return False


    # ========================================================
    # LATITUDE
    # ========================================================

    latitude = position.get(
        "Latitude"
    )

    if latitude is None:
        latitude = metadata.get(
            "Latitude"
        )

    latitude = safe_float(latitude)


    # ========================================================
    # LONGITUDE
    # ========================================================

    longitude = position.get(
        "Longitude"
    )

    if longitude is None:
        longitude = metadata.get(
            "Longitude"
        )

    longitude = safe_float(longitude)


    # ========================================================
    # COORDINATE VALIDATION
    # ========================================================

    if latitude is None or longitude is None:

        logger.warning(
            "MMSI=%s | Missing coordinates.",
            mmsi
        )

        return False

    if abs(latitude) < 1e-6 and abs(longitude) < 1e-6:

        logger.warning(
            "MMSI=%s | Rejected Null Island (0,0) coordinates.",
            mmsi
        )

        return False

    if not (-90 <= latitude <= 90):

        logger.warning(
            "MMSI=%s | Invalid latitude=%s",
            mmsi,
            latitude
        )

        return False

    if not (-180 <= longitude <= 180):

        logger.warning(
            "MMSI=%s | Invalid longitude=%s",
            mmsi,
            longitude
        )

        return False


    # ========================================================
    # SOG
    # AISStream Sog is in knots
    # ========================================================

    sog = safe_float(
        position.get("Sog")
    )


    # ========================================================
    # COG
    # ========================================================

    cog = safe_float(
        position.get("Cog")
    )


    # ========================================================
    # HEADING
    # ========================================================

    heading = safe_float(
        position.get("TrueHeading")
    )


    # ========================================================
    # NAVIGATIONAL STATUS
    # ========================================================

    status = safe_int(
        position.get("NavigationalStatus")
    )


    # ========================================================
    # VESSEL INFORMATION
    # ========================================================

    ship_name = clean_string(
        metadata.get("ShipName")
    )

    ship_type = clean_string(
        metadata.get("ShipType")
    )

    imo = clean_string(
        metadata.get("IMO")
    )

    destination = clean_string(
        metadata.get("Destination")
    )

    draught = safe_float(
        metadata.get("Draught")
    )


    # ========================================================
    # OBSERVATION TIMESTAMP
    # ========================================================
    #
    # We use the time at which our collector receives the
    # AIS message.
    #
    # This is stored in the friend's schema as `ts`.
    #
    # AIS Timestamp itself is NOT a Unix timestamp.
    # ========================================================

    ts = datetime.now(
        timezone.utc
    )


    # ========================================================
    # SOURCE
    # ========================================================

    source = "AISStream.io"


    # ========================================================
    # INSERT
    # ========================================================

    insert_position(
        conn=conn,
        mmsi=mmsi,
        imo=imo,
        ship_name=ship_name,
        ship_type=ship_type,
        latitude=latitude,
        longitude=longitude,
        sog=sog,
        cog=cog,
        heading=heading,
        status=status,
        ts=ts,
        destination=destination,
        draught=draught,
        source=source
    )

    conn.commit()


    # ========================================================
    # LOG
    # ========================================================

    logger.info(
        "AIS | MMSI=%s | NAME=%s | "
        "LAT=%.5f | LON=%.5f | "
        "SOG=%s kn | COG=%s° | HDG=%s°",
        mmsi,
        ship_name or "UNKNOWN",
        latitude,
        longitude,
        sog,
        cog,
        heading
    )

    return True


# ============================================================
# AISSTREAM SUBSCRIPTION
# ============================================================

def create_subscription():

    return {
        "APIKey": AISSTREAM_API_KEY,

        "BoundingBoxes": [
            [
                [
                    MIN_LAT,
                    MIN_LON
                ],
                [
                    MAX_LAT,
                    MAX_LON
                ]
            ]
        ],

        "FilterMessageTypes": [
            "PositionReport"
        ]
    }


# ============================================================
# WEBSOCKET STREAM
# ============================================================

async def run_stream():

    reconnect_delay = 5

    total_positions = 0

    while True:

        try:

            logger.info(
                "Connecting to AISStream.io..."
            )

            async with websockets.connect(
                AISSTREAM_URL,
                compression="deflate",
                ping_interval=20,
                ping_timeout=20,
                close_timeout=10,
                max_size=None
            ) as websocket:

                logger.info(
                    "Connected to AISStream.io"
                )


                # ====================================================
                # SEND SUBSCRIPTION
                # ====================================================

                subscription = create_subscription()

                await websocket.send(
                    json.dumps(subscription)
                )

                logger.info(
                    "AIS subscription sent."
                )

                logger.info(
                    "Bounding box: "
                    "LAT %.2f → %.2f | "
                    "LON %.2f → %.2f",
                    MIN_LAT,
                    MAX_LAT,
                    MIN_LON,
                    MAX_LON
                )


                # Reset reconnect delay
                reconnect_delay = 5


                # ====================================================
                # RECEIVE MESSAGES
                # ====================================================

                while True:

                    raw_message = await websocket.recv()


                    # =================================================
                    # AISStream may send binary UTF-8 JSON
                    # =================================================

                    if isinstance(
                        raw_message,
                        bytes
                    ):

                        raw_message = raw_message.decode(
                            "utf-8"
                        )


                    # =================================================
                    # PARSE JSON
                    # =================================================

                    try:

                        message = json.loads(
                            raw_message
                        )

                    except json.JSONDecodeError:

                        logger.warning(
                            "Received invalid JSON from AISStream."
                        )

                        continue


                    message_type = message.get(
                        "MessageType"
                    )


                    # =================================================
                    # SUBSCRIPTION CONFIRMATION
                    # =================================================

                    if message_type == "SubscriptionConfirmation":

                        confirmation = message.get(
                            "Message",
                            {}
                        )

                        compression_enabled = (
                            confirmation.get(
                                "CompressionEnabled"
                            )
                        )

                        logger.info(
                            "AIS subscription CONFIRMED."
                        )

                        logger.info(
                            "Compression enabled: %s",
                            compression_enabled
                        )

                        logger.info(
                            "Waiting for AIS PositionReports..."
                        )

                        continue


                    # =================================================
                    # POSITION REPORT
                    # =================================================

                    if message_type == "PositionReport":

                        try:

                            with get_db_connection() as conn:

                                inserted = (
                                    process_position_report(
                                        message,
                                        conn
                                    )
                                )

                            if inserted:

                                total_positions += 1

                                logger.info(
                                    "Total AIS positions stored: %d",
                                    total_positions
                                )

                        except psycopg.Error:

                            logger.exception(
                                "PostgreSQL error while storing AIS position."
                            )

                        except Exception:

                            logger.exception(
                                "Unexpected error while processing AIS position."
                            )

                        continue


                    # =================================================
                    # OTHER MESSAGE TYPES
                    # =================================================

                    logger.debug(
                        "AIS message received: %s",
                        message_type
                    )


        # ============================================================
        # WEBSOCKET CLOSED
        # ============================================================

        except websockets.exceptions.ConnectionClosed as e:

            logger.error(
                "AIS connection closed | code=%s | reason=%s",
                e.code,
                e.reason
            )


        # ============================================================
        # OTHER CONNECTION ERROR
        # ============================================================

        except Exception as e:

            logger.exception(
                "AIS connection error: %s",
                e
            )


        # ============================================================
        # RECONNECT
        # ============================================================

        jitter = random.uniform(
            0,
            2
        )

        wait_time = min(
            reconnect_delay + jitter,
            60
        )

        logger.info(
            "Reconnecting in %.1f seconds...",
            wait_time
        )

        await asyncio.sleep(
            wait_time
        )

        reconnect_delay = min(
            reconnect_delay * 2,
            60
        )


# ============================================================
# MAIN
# ============================================================

async def main():

    logger.info("=" * 70)

    logger.info(
        "EcoNavigators - AISStream.io AIS Collector"
    )

    logger.info("=" * 70)

    logger.info(
        "Monitoring region:"
    )

    logger.info(
        "LAT %.4f → %.4f",
        MIN_LAT,
        MAX_LAT
    )

    logger.info(
        "LON %.4f → %.4f",
        MIN_LON,
        MAX_LON
    )

    logger.info(
        "WebSocket: %s",
        AISSTREAM_URL
    )

    logger.info(
        "PostgreSQL database configured: YES"
    )

    logger.info("=" * 70)


    # ============================================================
    # TEST DATABASE
    # ============================================================

    try:

        test_database_connection()

    except Exception:

        logger.exception(
            "Could not connect to Supabase PostgreSQL."
        )

        raise


    # ============================================================
    # START AIS STREAM
    # ============================================================

    await run_stream()


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":

    try:

        asyncio.run(
            main()
        )

    except KeyboardInterrupt:

        logger.info(
            "AIS collector stopped by user."
        )