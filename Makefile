COMPOSE := docker compose -f deploy/docker-compose.yml --project-directory .

.PHONY: dev dev-detached down test lint seed build logs clean

dev:
	$(COMPOSE) up --build

dev-detached:
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down

test:
	cd api && npm test
	cd runner && npm test
	cd frontend && npm test

lint:
	cd api && npm run lint
	cd runner && npm run lint
	cd frontend && npm run lint

seed:
	cd scripts && npm install && npx tsx seed.ts

build:
	$(COMPOSE) build

logs:
	$(COMPOSE) logs -f

clean:
	$(COMPOSE) down -v --remove-orphans
