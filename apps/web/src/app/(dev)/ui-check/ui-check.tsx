"use client";

import { useRef, useState, type ComponentRef } from "react";
import {
  Button,
  Column,
  Dialog,
  Heading,
  restoreFocus,
  Screen,
  StatusPill,
  Text,
  VisibilityChip,
  WishCard,
  XStack,
} from "@gift-list/ui";

// Служебные тексты dev-страницы: не пользовательский интерфейс, в каталог не идут.
export function UiCheck() {
  const [open, setOpen] = useState(false);
  const opener = useRef<ComponentRef<typeof Button>>(null);

  function handleOpen() {
    setOpen(true);
  }
  function handleClose() {
    setOpen(false);
  }
  function handleClosed() {
    restoreFocus(opener.current);
  }
  function handleNoop() {}

  return (
    <Screen>
      <Column size="wide" gap="$4" paddingVertical="$5" paddingHorizontal="$4">
        <Heading level={1} kind="display-sm">
          UI check
        </Heading>
        <Text tone="muted">Проверка SSR Tamagui и слоя Dialog на Next.</Text>
        <XStack role="list" flexWrap="wrap" gap="$3">
          <WishCard
            title="Плед"
            price="2 500 ₽"
            status={<StatusPill status="open" label="Свободно" />}
            chip={<VisibilityChip tone="public" label="Всем" />}
            width={240}
            testID="ui-check-card-open"
          />
          <WishCard
            title="Книга"
            price="900 ₽"
            status={<StatusPill status="reserved" label="Забронировано" />}
            chip={<VisibilityChip tone="friends" label="Друзьям" />}
            width={240}
            testID="ui-check-card-reserved"
          />
        </XStack>
        <XStack gap="$2" flexWrap="wrap">
          <Button
            label="Забронировать"
            variant="reserve"
            onPress={handleNoop}
          />
          <Button label="Отмена" variant="secondary" onPress={handleNoop} />
          <Button
            ref={opener}
            label="Открыть Dialog"
            variant="primary"
            onPress={handleOpen}
            testID="ui-check-open"
          />
        </XStack>
      </Column>
      <Dialog
        open={open}
        title="Dialog"
        description="Закрывается кнопкой, Esc и подложкой."
        onClose={handleClose}
        onClosed={handleClosed}
        actions={
          <Button
            label="Закрыть"
            variant="secondary"
            onPress={handleClose}
            testID="ui-check-close"
          />
        }
        testID="ui-check-dialog"
      >
        <Text>Содержимое слоя.</Text>
      </Dialog>
    </Screen>
  );
}

UiCheck.displayName = "UiCheck";
