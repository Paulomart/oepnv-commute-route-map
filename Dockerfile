FROM node:18 AS build

WORKDIR /app

COPY ./frontend/package.json package.json
COPY ./frontend/package-lock.json package-lock.json

RUN npm install

COPY ./frontend .

RUN npm run build


FROM python:3.11.4 AS runtime

WORKDIR /app

COPY ./backend/requirements.txt requirments.txt
RUN pip install -r requirments.txt

COPY ./backend .
COPY --from=build /app/build ./static

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "80"]
