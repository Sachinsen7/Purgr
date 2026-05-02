FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEVSWEEP_API_HOST=0.0.0.0 \
    DEVSWEEP_API_PORT=9231

WORKDIR /app

COPY . /app

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir .

EXPOSE 9231

CMD ["python", "-m", "devsweep.api"]
