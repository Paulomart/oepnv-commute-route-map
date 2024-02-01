from datetime import datetime, timedelta


def get_9am_on_next_monday() -> datetime:
    now = datetime.now()
    monday = now + timedelta(days=-now.weekday(), weeks=1)
    monday_at_9am = monday.replace(hour=9, minute=0, second=0, microsecond=0)

    return monday_at_9am
