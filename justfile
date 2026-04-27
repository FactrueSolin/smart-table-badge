set shell := ["sh", "-eu", "-c"]

default:
    @just --list

install:
    @pnpm install --frozen-lockfile

dev:
    @pnpm dev

typecheck:
    @pnpm typecheck

lint:
    @pnpm lint

test:
    @pnpm test

check: typecheck lint test

build:
    @pnpm build

start:
    @pnpm start

deploy-macos:
    @just/macos-deploy.sh install

deploy-macos-user:
    @MACOS_SERVICE_SCOPE=user just/macos-deploy.sh install

macos-status:
    @just/macos-deploy.sh status

macos-restart:
    @just/macos-deploy.sh restart

macos-logs:
    @just/macos-deploy.sh logs

macos-logs-follow:
    @FOLLOW=1 just/macos-deploy.sh logs

macos-uninstall:
    @just/macos-deploy.sh uninstall
