import { Button, Dialog, YStack } from "@gift-list/ui";

/**
 * Один пункт меню ⋯ карточки желания. `destructive` — коралловый: «Удалить»
 * закрытое желание (`DESIGN.md` → Colors: destructive только для потери данных).
 */
export type GiftCardMenuAction = {
  key: string;
  /** Видимый текст и доступное имя пункта. */
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

/**
 * Story 5.3: меню ⋯ карточки владельца. У открытого и забронированного желания в
 * нём «Отметить полученным», у закрытого — «Вернуть в открытые · ещё N мин» (пока
 * окно открыто), «Хочу ещё такой» и «Удалить».
 *
 * Меню — тот же слой `Dialog`, что и меню архива (Story 2.6): слой открывает
 * экран, поэтому пункты и их доступность принадлежат ему. Компонент ничего не
 * решает сам и текстов из каталога не берёт — только рисует переданные пункты,
 * поэтому у него нет ни таймеров, ни окна отмены.
 */
export function GiftCardMenu({
  open,
  title,
  actions,
  closeLabel,
  onClose,
  onClosed,
  onSelect,
  testID,
}: {
  open: boolean;
  /** Название слоя: название желания. */
  title: string;
  actions: readonly GiftCardMenuAction[];
  /** «Закрыть» — единственная кнопка ряда действий слоя. */
  closeLabel: string;
  /** Esc, крестик, скрим и системное «назад»: экран убирает меню. */
  onClose: () => void;
  /** Слой ушёл из дерева: экран возвращает фокус на ⋯ и выполняет выбранный пункт. */
  onClosed?: () => void;
  /**
   * Выбранный пункт. Экран закрывает слой сам и выполняет работу после его
   * ухода, поэтому меню не запускает действие внутри себя.
   */
  onSelect: (action: GiftCardMenuAction) => void;
  testID?: string;
}) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      onClosed={onClosed}
      testID={testID}
      actions={<Button variant="ghost" label={closeLabel} onPress={onClose} />}
    >
      <YStack gap="$2">
        {actions.map(function renderAction(action) {
          function choose() {
            onSelect(action);
          }

          return (
            <Button
              key={action.key}
              label={action.label}
              variant={action.destructive ? "destructive" : "primary"}
              fullWidth
              onPress={choose}
              testID={testID ? `${testID}-${action.key}` : undefined}
            />
          );
        })}
      </YStack>
    </Dialog>
  );
}

GiftCardMenu.displayName = "GiftCardMenu";
