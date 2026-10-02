"use client";

import { useActionState, useState } from "react";
import { register, type RegisterState } from "@/actions/register";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NICK_RULES_TEXT, normalizeNick } from "@/domain/nick";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

export function RegisterForm() {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(
    register,
    null,
  );
  const [nick, setNick] = useState("");
  const errors = state?.fieldErrors ?? {};
  const preview = normalizeNick(nick);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="displayName">Имя</Label>
        <Input
          id="displayName"
          name="displayName"
          autoComplete="name"
          required
          maxLength={50}
          aria-invalid={Boolean(errors.displayName)}
          aria-describedby={errors.displayName ? "displayName-error" : undefined}
        />
        <FieldError id="displayName-error" message={errors.displayName} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="nick">Ник</Label>
        <Input
          id="nick"
          name="nick"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={24}
          value={nick}
          onChange={(event) => setNick(event.target.value)}
          aria-invalid={Boolean(errors.nick)}
          aria-describedby={errors.nick ? "nick-error nick-hint" : "nick-hint"}
        />
        <p id="nick-hint" className="text-sm text-muted-foreground">
          {preview ? <>Вас найдут как <strong>@{preview}</strong>. </> : null}
          {NICK_RULES_TEXT}
        </p>
        <FieldError id="nick-error" message={errors.nick} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        <FieldError id="email-error" message={errors.email} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Пароль</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={
            errors.password ? "password-error password-hint" : "password-hint"
          }
        />
        <p id="password-hint" className="text-sm text-muted-foreground">
          Не короче 8 символов
        </p>
        <FieldError id="password-error" message={errors.password} />
      </div>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Создаём аккаунт…" : "Создать аккаунт"}
      </Button>
    </form>
  );
}
