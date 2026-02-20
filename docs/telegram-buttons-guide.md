# Руководство по использованию нативных кнопок Telegram

Telegram WebApp предоставляет нативные кнопки интерфейса, которые интегрируются в UI клиента Telegram и обеспечивают лучший UX для пользователей.

## MainButton (Главная кнопка)

MainButton — это основная кнопка действия, которая отображается внизу экрана в Telegram клиенте.

### Основные возможности

- Фиксированное положение внизу экрана
- Автоматическая адаптация под тему Telegram
- Встроенный индикатор загрузки
- Возможность отключения/включения

### Использование в React

```tsx
import { useTelegramMainButton } from "@/hooks/use-telegram-main-button";

function SaveForm() {
  const [isSaving, setIsSaving] = useState(false);

  const { setProgress } = useTelegramMainButton({
    text: "Сохранить",
    onClick: async () => {
      setIsSaving(true);
      setProgress(true);
      
      try {
        await saveData();
        // Успешно сохранено
      } catch (error) {
        console.error(error);
      } finally {
        setProgress(false);
        setIsSaving(false);
      }
    },
    isActive: !isSaving,
    isVisible: true
  });

  return (
    <div>
      {/* Ваша форма */}
    </div>
  );
}
```

### API хука useTelegramMainButton

#### Параметры

```typescript
interface MainButtonParams {
  text: string;                    // Текст кнопки
  onClick: () => void;             // Обработчик клика
  color?: string;                  // Цвет фона (hex)
  textColor?: string;              // Цвет текста (hex)
  isActive?: boolean;              // Активна ли кнопка (default: true)
  isVisible?: boolean;             // Видима ли кнопка (default: true)
  isProgressVisible?: boolean;     // Показывать индикатор загрузки (default: false)
}
```

#### Возвращаемые методы

```typescript
{
  showButton: () => void;          // Показать кнопку
  hideButton: () => void;          // Скрыть кнопку
  setProgress: (visible: boolean) => void;  // Управление индикатором загрузки
  enable: () => void;              // Активировать кнопку
  disable: () => void;             // Деактивировать кнопку
  setText: (text: string) => void; // Изменить текст
}
```

### Примеры использования

#### Кнопка "Сохранить" в форме

```tsx
const { setProgress, disable, enable } = useTelegramMainButton({
  text: "Сохранить изменения",
  onClick: handleSave,
  isVisible: isDirty, // Показывать только если есть изменения
  isActive: isValid   // Активна только если форма валидна
});
```

#### Кнопка "Создать" с динамическим текстом

```tsx
const { setText } = useTelegramMainButton({
  text: "Создать акт",
  onClick: handleCreate
});

useEffect(() => {
  if (selectedTemplate) {
    setText(`Создать ${selectedTemplate.name}`);
  }
}, [selectedTemplate, setText]);
```

#### Кнопка с индикатором загрузки

```tsx
const { setProgress } = useTelegramMainButton({
  text: "Экспортировать PDF",
  onClick: async () => {
    setProgress(true);
    try {
      await exportPDF();
    } finally {
      setProgress(false);
    }
  }
});
```

## BackButton (Кнопка "Назад")

BackButton — это кнопка навигации, которая отображается в заголовке Telegram клиента слева.

### Основные возможности

- Автоматическое позиционирование в заголовке
- Стандартная иконка стрелки назад
- Адаптация под тему Telegram

### Использование в React

```tsx
import { useTelegramBackButton } from "@/hooks/use-telegram-back-button";
import { useLocation } from "wouter";

function DetailPage() {
  const [, navigate] = useLocation();

  useTelegramBackButton({
    onClick: () => navigate('/'),
    isVisible: true
  });

  return (
    <div>
      {/* Контент страницы */}
    </div>
  );
}
```

### API хука useTelegramBackButton

#### Параметры

```typescript
interface BackButtonParams {
  onClick: () => void;    // Обработчик клика
  isVisible?: boolean;    // Видима ли кнопка (default: true)
}
```

#### Возвращаемые методы

```typescript
{
  showButton: () => void;  // Показать кнопку
  hideButton: () => void;  // Скрыть кнопку
}
```

### Примеры использования

#### Навигация назад на предыдущую страницу

```tsx
import { useLocation } from "wouter";

function EditPage() {
  const [, navigate] = useLocation();

  useTelegramBackButton({
    onClick: () => navigate(-1) // или navigate('/previous-route')
  });

  return <div>Редактирование...</div>;
}
```

#### Условное отображение

```tsx
function ModalPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { showButton, hideButton } = useTelegramBackButton({
    onClick: () => setIsModalOpen(false)
  });

  useEffect(() => {
    if (isModalOpen) {
      showButton();
    } else {
      hideButton();
    }
  }, [isModalOpen, showButton, hideButton]);

  return <div>...</div>;
}
```

#### Подтверждение перед выходом

```tsx
function FormPage() {
  const [isDirty, setIsDirty] = useState(false);
  const [, navigate] = useLocation();

  useTelegramBackButton({
    onClick: () => {
      if (isDirty) {
        if (confirm('Есть несохраненные изменения. Выйти?')) {
          navigate('/');
        }
      } else {
        navigate('/');
      }
    }
  });

  return <div>...</div>;
}
```

## Рекомендации по использованию

### MainButton

✅ **Используйте для:**
- Основного действия на экране (Сохранить, Создать, Отправить)
- Действий, требующих подтверждения
- Завершающих действий в форме

❌ **Не используйте для:**
- Навигации между экранами
- Второстепенных действий
- Множественных действий на одном экране

### BackButton

✅ **Используйте для:**
- Возврата на предыдущий экран
- Закрытия модальных окон
- Отмены текущего действия

❌ **Не используйте для:**
- Основных действий (используйте MainButton)
- Навигации вперед

## Комбинирование кнопок

Вы можете использовать обе кнопки одновременно:

```tsx
function EditActPage() {
  const [, navigate] = useLocation();
  const [isSaving, setIsSaving] = useState(false);

  // BackButton для возврата
  useTelegramBackButton({
    onClick: () => {
      if (isDirty && !confirm('Выйти без сохранения?')) {
        return;
      }
      navigate('/acts');
    }
  });

  // MainButton для сохранения
  const { setProgress } = useTelegramMainButton({
    text: "Сохранить акт",
    onClick: async () => {
      setIsSaving(true);
      setProgress(true);
      try {
        await saveAct();
        navigate('/acts');
      } finally {
        setProgress(false);
        setIsSaving(false);
      }
    },
    isActive: !isSaving && isDirty
  });

  return <div>...</div>;
}
```

## Автоматическая очистка

Оба хука автоматически очищают обработчики событий и скрывают кнопки при размонтировании компонента, поэтому вам не нужно беспокоиться об утечках памяти.

## Fallback для веб-версии

Если приложение открыто не в Telegram (например, в обычном браузере), кнопки не будут отображаться. Рекомендуется добавить альтернативные UI-элементы:

```tsx
const tg = window.Telegram?.WebApp;
const isInTelegram = !!tg;

function SaveForm() {
  const { setProgress } = useTelegramMainButton({
    text: "Сохранить",
    onClick: handleSave
  });

  return (
    <div>
      <form>
        {/* Поля формы */}
      </form>
      
      {/* Показываем обычную кнопку если не в Telegram */}
      {!isInTelegram && (
        <button onClick={handleSave} className="btn-primary">
          Сохранить
        </button>
      )}
    </div>
  );
}
```

## Отладка

Если кнопки не работают:

1. Проверьте, что `telegram-web-app.js` загружен
2. Убедитесь, что `Telegram.WebApp.ready()` вызван
3. Проверьте консоль на наличие ошибок
4. Убедитесь, что приложение открыто в Telegram клиенте

## Дополнительные ресурсы

- [Telegram WebApp API - MainButton](https://core.telegram.org/bots/webapps#mainbutton)
- [Telegram WebApp API - BackButton](https://core.telegram.org/bots/webapps#backbutton)
