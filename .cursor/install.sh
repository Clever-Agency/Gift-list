#!/usr/bin/env bash
# Окружение облачного агента: зависимости проекта (npm ci, как в CI) и uv для воркфлоу BMAD.
# Повторный запуск безопасен. Если sudo нет, скрипт не падает, а добавляет ~/.local/bin в PATH login-shell.
set -euo pipefail

install_uv() {
  if command -v uv >/dev/null 2>&1 && uv --version >/dev/null 2>&1; then
    return 0
  fi
  if [[ -x "${HOME}/.local/bin/uv" ]]; then
    return 0
  fi
  # UV_NO_MODIFY_PATH: установщик не правит ~/.bashrc. Для login-shell это всё равно не срабатывает.
  curl -LsSf https://astral.sh/uv/install.sh | UV_NO_MODIFY_PATH=1 sh
}

# Неинтерактивный login-shell не читает правки ~/.bashrc. Без sudo кладём ~/.local/bin в ~/.profile.
persist_local_bin() {
  local marker="# Added by .cursor/install.sh so login shells find uv"
  local line='export PATH="$HOME/.local/bin:$PATH"'
  local file="${HOME}/.profile"

  touch "$file"
  if ! grep -qF "$marker" "$file"; then
    printf '\n%s\n%s\n' "$marker" "$line" >> "$file"
  fi

  # ~/.bash_profile, если он уже есть, перекрывает ~/.profile. Новый файл не создаём:
  # иначе bash перестанет читать ~/.profile.
  if [[ -f "${HOME}/.bash_profile" ]] && ! grep -qF "$marker" "${HOME}/.bash_profile"; then
    printf '\n%s\n%s\n' "$marker" "$line" >> "${HOME}/.bash_profile"
  fi

  export PATH="${HOME}/.local/bin:${PATH}"
}

link_uv() {
  local bin_dir="${HOME}/.local/bin"

  if [[ ! -x "${bin_dir}/uv" ]]; then
    if command -v uv >/dev/null 2>&1 && uv --version >/dev/null 2>&1; then
      return 0
    fi
    echo "uv не найден после установки." >&2
    exit 1
  fi

  if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
    if sudo -n ln -sfn "${bin_dir}/uv" /usr/local/bin/uv \
      && { [[ ! -x "${bin_dir}/uvx" ]] || sudo -n ln -sfn "${bin_dir}/uvx" /usr/local/bin/uvx; }; then
      return 0
    fi
    echo "Симлинк в /usr/local/bin не создался. Добавляю ~/.local/bin в PATH." >&2
  else
    echo "sudo недоступен. Добавляю ~/.local/bin в PATH." >&2
  fi

  persist_local_bin
}

main() {
  local root node_major
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  cd "$root"

  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    echo "Нужны node и npm. Проект рассчитан на Node.js 24.x (engines в package.json, как в CI)." >&2
    exit 1
  fi

  node_major="$(node -p 'process.versions.node.split(".")[0]')"
  if [[ "$node_major" != "24" ]]; then
    echo "Ожидается Node.js 24.x (engines и CI). Сейчас $(node -v). Продолжаю npm ci." >&2
  fi

  npm ci
  install_uv
  link_uv

  export PATH="/usr/local/bin:${HOME}/.local/bin:${PATH}"
  hash -r || true
  uv --version
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main
fi
