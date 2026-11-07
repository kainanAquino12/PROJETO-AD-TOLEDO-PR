#!/bin/bash
# Commit e push automaticos ao fim de cada resposta do Claude.
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || cd "$(dirname "$0")/.." || exit 0
git add -A
git add -f public/uploads/hero-aperto-de-maos-2.jpg 2>/dev/null
if git diff --cached --quiet; then exit 0; fi
git commit -q -m "Atualização automática do site" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" || exit 0
git push -q origin HEAD 2>&1 || echo '{"systemMessage":"Commit feito, mas o push falhou. Verifique a conexão/credenciais do GitHub."}'
