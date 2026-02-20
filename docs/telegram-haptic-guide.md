# Руководство по использованию HapticFeedback

Тактильная обратная связь (haptic feedback) улучшает пользовательский опыт, предоставляя физическую реакцию на действия пользователя. Telegram WebApp предоставляет API для интеграции haptic feedback в ваше приложение.

## Типы тактильной обратной связи

### 1. Impact (Воздействие)

Используется для обратной связи на физические действия пользователя.

#### Стили impact:

- **`light`** - Легкое касание
  - Использование: кнопки, переключатели, чекбоксы
  - Интенсивность: минимальная
  
- **`medium`** - Среднее воздействие
  - Использование: сохранение данных, подтверждение действий
  - Интенсивность: средняя
  
- **`heavy`** - Сильное воздействие
  - Использование: удаление, критичные действия, финальные операции
  - Интенсивность: максимальная

- **`rigid`** - Жесткое воздействие
  - Использование: достижение границ (scroll limits), ограничения
  - Интенсивность: резкая, короткая

- **`soft`** - Мягкое воздействие
  - Использование: плавные переходы, drag & drop
  - Интенсивность: мягкая, продолжительная

### 2. Notification (Уведомление)

Используется для обратной связи о результате операции.

#### Типы notification:

- **`success`** - Успешная операция
  - Использование: успешное сохранение, создание, отправка
  - Паттерн: короткая-пауза-короткая вибрация
  
- **`error`** - Ошибка
  - Использование: ошибка валидации, сбой операции
  - Паттерн: три короткие вибрации
  
- **`warning`** - Предупреждение
  - Использование: предупреждения, требующие внимания
  - Паттерн: две короткие вибрации

### 3. Selection Changed (Изменение выбора)

Используется при изменении выбранного элемента.

- Использование: переключение между вкладками, выбор из списка, слайдеры
- Паттерн: очень короткая вибрация

## Использование в React

### Базовый пример

```tsx
import { useTelegramHaptic } from "@/hooks/use-telegram-haptic";

function MyComponent() {
  const haptic = useTelegramHaptic();

  const handleClick = () => {
    haptic.impact('light');
    // Ваша логика
  };

  return (
    <button onClick={handleClick}>
      Нажми меня
    </button>
  );
}
```

## Примеры использования по сценариям

### Кнопки и UI-элементы

```tsx
function Button({ onClick, children }) {
  const haptic = useTelegramHaptic();

  const handleClick = () => {
    haptic.impact('light');
    onClick();
  };

  return (
    <button onClick={handleClick}>
      {children}
    </button>
  );
}
```

### Переключатели (Toggle/Switch)

```tsx
function Toggle({ value, onChange }) {
  const haptic = useTelegramHaptic();

  const handleToggle = () => {
    haptic.selectionChanged();
    onChange(!value);
  };

  return (
    <input 
      type="checkbox" 
      checked={value} 
      onChange={handleToggle}
    />
  );
}
```

### Сохранение данных

```tsx
function SaveForm() {
  const haptic = useTelegramHaptic();

  const handleSave = async () => {
    haptic.impact('medium'); // Обратная связь при нажатии
    
    try {
      await saveData();
      haptic.notificationOccurred('success'); // Успех
    } catch (error) {
      haptic.notificationOccurred('error'); // Ошибка
    }
  };

  return (
    <button onClick={handleSave}>
      Сохранить
    </button>
  );
}
```

### Удаление элемента

```tsx
function DeleteButton({ onDelete }) {
  const haptic = useTelegramHaptic();

  const handleDelete = async () => {
    if (!confirm('Удалить элемент?')) {
      return;
    }

    haptic.impact('heavy'); // Сильная обратная связь для критичного действия
    
    try {
      await onDelete();
      haptic.notificationOccurred('success');
    } catch (error) {
      haptic.notificationOccurred('error');
    }
  };

  return (
    <button onClick={handleDelete} className="btn-danger">
      Удалить
    </button>
  );
}
```

### Табы и навигация

```tsx
function Tabs({ tabs, activeTab, onChange }) {
  const haptic = useTelegramHaptic();

  const handleTabChange = (tabId) => {
    if (tabId !== activeTab) {
      haptic.selectionChanged();
      onChange(tabId);
    }
  };

  return (
    <div className="tabs">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => handleTabChange(tab.id)}
          className={activeTab === tab.id ? 'active' : ''}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

### Слайдер

```tsx
function Slider({ value, onChange }) {
  const haptic = useTelegramHaptic();
  const lastValue = useRef(value);

  const handleChange = (e) => {
    const newValue = parseInt(e.target.value);
    
    // Обратная связь только при изменении значения
    if (newValue !== lastValue.current) {
      haptic.selectionChanged();
      lastValue.current = newValue;
    }
    
    onChange(newValue);
  };

  return (
    <input
      type="range"
      value={value}
      onChange={handleChange}
      min={0}
      max={100}
    />
  );
}
```

### Валидация формы

```tsx
function Form() {
  const haptic = useTelegramHaptic();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const errors = validateForm();
    
    if (errors.length > 0) {
      haptic.notificationOccurred('error');
      showErrors(errors);
      return;
    }

    haptic.impact('medium');
    
    try {
      await submitForm();
      haptic.notificationOccurred('success');
    } catch (error) {
      haptic.notificationOccurred('error');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Поля формы */}
    </form>
  );
}
```

### Drag & Drop

```tsx
function DraggableItem() {
  const haptic = useTelegramHaptic();

  const handleDragStart = () => {
    haptic.impact('soft');
  };

  const handleDragEnd = () => {
    haptic.impact('light');
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      Перетащите меня
    </div>
  );
}
```

## Использование вне React компонентов

Для использования haptic feedback в утилитах или обработчиках событий вне React:

```typescript
import { haptic } from "@/hooks/use-telegram-haptic";

// В обычной функции
function deleteItem(id: number) {
  haptic.impact('heavy');
  
  api.delete(`/items/${id}`)
    .then(() => haptic.notificationOccurred('success'))
    .catch(() => haptic.notificationOccurred('error'));
}

// В event listener
document.addEventListener('click', (e) => {
  if (e.target.matches('.button')) {
    haptic.impact('light');
  }
});
```

## Best Practices

### ✅ Рекомендуется

1. **Используйте haptic для важных действий**
   - Подтверждение операций
   - Успех/ошибка
   - Критичные действия

2. **Соответствие интенсивности действию**
   - `light` для обычных кликов
   - `medium` для сохранения
   - `heavy` для удаления

3. **Обратная связь на результат**
   - `success` при успехе
   - `error` при ошибке
   - `warning` для предупреждений

4. **Используйте `selectionChanged` для навигации**
   - Переключение табов
   - Выбор из списка
   - Изменение слайдера

### ❌ Не рекомендуется

1. **Избыточное использование**
   - Не добавляйте haptic на каждое действие
   - Не используйте на hover или focus
   - Избегайте haptic при скролле

2. **Несоответствие интенсивности**
   - Не используйте `heavy` для обычных кликов
   - Не используйте `light` для критичных действий

3. **Haptic без действия**
   - Не вызывайте haptic если действие не выполнено
   - Не используйте для декоративных эффектов

4. **Дублирование feedback**
   - Не используйте несколько haptic для одного действия
   - Не комбинируйте `impact` и `notification` одновременно

## Матрица использования

| Действие | Тип | Стиль | Когда |
|----------|-----|-------|-------|
| Клик по кнопке | `impact` | `light` | При нажатии |
| Переключатель | `selectionChanged` | - | При изменении |
| Сохранение | `impact` + `notification` | `medium` + `success/error` | При нажатии + результат |
| Удаление | `impact` + `notification` | `heavy` + `success/error` | При нажатии + результат |
| Переключение таба | `selectionChanged` | - | При смене таба |
| Ошибка валидации | `notification` | `error` | При обнаружении ошибки |
| Успешная отправка | `notification` | `success` | После завершения |
| Предупреждение | `notification` | `warning` | При показе предупреждения |
| Drag start | `impact` | `soft` | При начале перетаскивания |
| Drag end | `impact` | `light` | При завершении |
| Достижение лимита | `impact` | `rigid` | При достижении границы |

## Проверка доступности

Haptic feedback доступен только в Telegram клиентах. Для веб-версии:

```tsx
function Button({ onClick }) {
  const tg = window.Telegram?.WebApp;
  const haptic = useTelegramHaptic();

  const handleClick = () => {
    // Haptic будет работать только в Telegram
    if (tg?.HapticFeedback) {
      haptic.impact('light');
    }
    onClick();
  };

  return <button onClick={handleClick}>Click</button>;
}
```

Хуки автоматически проверяют доступность API, поэтому можно использовать без дополнительных проверок:

```tsx
// Безопасно - не вызовет ошибку если API недоступен
haptic.impact('light');
```

## Тестирование

При разработке haptic feedback работает только на реальных устройствах в Telegram клиенте. В браузере и эмуляторах вибрация не воспроизводится.

Для тестирования:
1. Откройте приложение в Telegram на мобильном устройстве
2. Проверьте, что вибрация включена в настройках устройства
3. Проверьте, что вибрация включена в настройках Telegram

## Дополнительные ресурсы

- [Telegram WebApp API - HapticFeedback](https://core.telegram.org/bots/webapps#hapticfeedback)
- [Apple Human Interface Guidelines - Haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics)
- [Material Design - Haptic Feedback](https://m3.material.io/foundations/interaction/haptics)
