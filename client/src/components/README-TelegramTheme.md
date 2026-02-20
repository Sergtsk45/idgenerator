# Использование темы Telegram в компонентах

## Обзор

Приложение автоматически применяет тему Telegram через `TelegramThemeProvider`. Все CSS-переменные Telegram доступны глобально.

## CSS-переменные Telegram

```css
--tg-theme-bg-color              /* Основной цвет фона */
--tg-theme-text-color            /* Основной цвет текста */
--tg-theme-hint-color            /* Цвет подсказок/второстепенного текста */
--tg-theme-link-color            /* Цвет ссылок */
--tg-theme-button-color          /* Цвет кнопок */
--tg-theme-button-text-color     /* Цвет текста на кнопках */
--tg-theme-secondary-bg-color    /* Вторичный цвет фона */
--tg-theme-header-bg-color       /* Цвет фона заголовка */
--tg-theme-accent-text-color     /* Акцентный цвет текста */
--tg-theme-section-bg-color      /* Цвет фона секций */
--tg-theme-section-header-text-color /* Цвет текста заголовков секций */
--tg-theme-subtitle-text-color   /* Цвет подзаголовков */
--tg-theme-destructive-text-color /* Цвет для деструктивных действий */
```

## Утилитарные классы

```tsx
// Фон
<div className="tg-bg">Основной фон Telegram</div>
<div className="tg-secondary-bg">Вторичный фон Telegram</div>

// Текст
<p className="tg-text">Основной текст</p>
<p className="tg-hint">Подсказка</p>
<p className="tg-accent">Акцентный текст</p>
<a className="tg-link">Ссылка</a>

// Кнопки
<button className="tg-button">Кнопка Telegram</button>

// Деструктивные действия
<span className="tg-destructive">Удалить</span>
```

## Использование в компонентах

### Прямое использование CSS-переменных

```tsx
const MyComponent = () => {
  return (
    <div style={{ 
      backgroundColor: 'var(--tg-theme-bg-color)',
      color: 'var(--tg-theme-text-color)'
    }}>
      Контент
    </div>
  );
};
```

### Использование хука useTelegram

```tsx
import { useTelegram } from '@/hooks/useTelegram';

const MyComponent = () => {
  const { themeParams, colorScheme } = useTelegram();
  
  return (
    <div>
      <p>Текущая тема: {colorScheme}</p>
      <p>Цвет кнопки: {themeParams.button_color}</p>
    </div>
  );
};
```

### Адаптивные стили на основе темы

```tsx
import { useTelegram } from '@/hooks/useTelegram';

const MyComponent = () => {
  const { colorScheme } = useTelegram();
  
  return (
    <div className={colorScheme === 'dark' ? 'dark-specific-styles' : 'light-specific-styles'}>
      Контент с адаптивными стилями
    </div>
  );
};
```

## Автоматическое переключение темы

`TelegramThemeProvider` автоматически:
- Устанавливает CSS-переменные при монтировании
- Обновляет переменные при изменении темы в Telegram
- Добавляет/удаляет класс `dark` на `<html>` элементе
- Работает как в Telegram, так и в браузере (с дефолтными значениями)

## Совместимость с Tailwind CSS

Все стандартные классы Tailwind продолжают работать. Утилитарные классы Telegram дополняют, а не заменяют Tailwind.

```tsx
<div className="tg-bg p-4 rounded-lg shadow-md">
  <h2 className="tg-text text-xl font-bold">Заголовок</h2>
  <p className="tg-hint text-sm">Подсказка</p>
</div>
```

## Тестирование вне Telegram

При запуске вне Telegram используются дефолтные значения:
- `bg_color`: #ffffff (светлая тема)
- `text_color`: #000000
- `button_color`: #3390ec (синий Telegram)
- И т.д.

Это позволяет разрабатывать и тестировать приложение в обычном браузере.
