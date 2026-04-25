FROM m.daocloud.io/docker.io/library/python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_INDEX_URL=https://mirrors.cloud.tencent.com/pypi/simple/ \
    UV_HTTP_TIMEOUT=300 \
    UV_HTTP_RETRIES=5 \
    UV_CONCURRENT_DOWNLOADS=1 \
    UV_CONCURRENT_INSTALLS=1 \
    TZ=Asia/Shanghai

WORKDIR /app

# 设置时区为上海（解决容器默认 UTC 导致时间偏差）
RUN ln -snf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && echo "Asia/Shanghai" > /etc/timezone

# 替换为腾讯云镜像源（解决国内网络问题）
RUN sed -i 's|deb.debian.org|mirrors.cloud.tencent.com|g' /etc/apt/sources.list.d/debian.sources

# 基础工具 + 字体 + xvfb + OpenCV 依赖（Playwright 系统依赖由 install-deps 自动安装）
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
    fonts-liberation fonts-noto-color-emoji \
    xvfb \
    libgl1 libglib2.0-0t64 \
    && rm -rf /var/lib/apt/lists/*

# 安装 uv（pip 方式，避免 astral.sh/ghcr.io 国内无法访问）
RUN pip install --no-cache-dir uv -i https://mirrors.cloud.tencent.com/pypi/simple/

# 安装 Python 依赖（利用 layer 缓存）
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# 依赖已在 .venv 中安装完成，这里直接复用虚拟环境，避免 uv run 再次触发同步
RUN .venv/bin/playwright install chromium \
    && .venv/bin/playwright install-deps chromium

# 复制项目代码
COPY . .

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8002

ENTRYPOINT ["/docker-entrypoint.sh"]
