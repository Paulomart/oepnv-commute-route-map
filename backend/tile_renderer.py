from PIL import Image, ImageDraw, ImageFont
from typing import Optional
from datetime import timedelta
import io


def minute_to_color(timedelta: Optional[timedelta]):
    if timedelta is None:
        return (0, 0, 255)  # blue

    minutes = int(timedelta.total_seconds() / 60)

    max_minutes = 60
    if minutes > max_minutes:
        minutes = max_minutes

    return calculate_color(minutes / max_minutes)


def calculate_color(percent):
    if percent > 1:
        percent = 1
    elif percent < 0:
        percent = 0

    red = int(percent * 255)
    green = int((1 - percent) * 255)
    blue = 0

    return (red, green, blue)


def render_tile(
    tile_size: int, best_journey_time: Optional[timedelta], mark_as_new_tile=False
) -> bytes:
    color = minute_to_color(best_journey_time)

    best_journey_time_text = "N/A"
    if best_journey_time is not None:
        best_journey_time_text = f"{int(best_journey_time.total_seconds() / 60)} min"

    if mark_as_new_tile:
        best_journey_time_text = best_journey_time_text + "*"

    color = (int(color[0]), int(color[1]), int(color[2]), 255)

    image_size = tile_size
    image = Image.new("RGBA", (image_size, image_size), color=color)

    draw = ImageDraw.Draw(image)
    draw.font = ImageFont.load_default(30 * tile_size / 128)

    _, _, text_width, text_height = draw.textbbox((0, 0), best_journey_time_text)
    draw.text(
        ((image_size - text_width) / 2, (image_size - text_height) / 2),
        best_journey_time_text,
        fill=(0, 0, 0),
    )

    byte_io = io.BytesIO()
    image.save(byte_io, "PNG")

    return byte_io.getvalue()
