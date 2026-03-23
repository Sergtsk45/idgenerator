# Git-стратегия и деплой tablet UI

**Дата**: 2026-03-10  
**Статус**: Draft  
**Цель**: Зафиксировать рабочую схему ветвления, merge и деплоя на тестовый сервер для внедрения нового tablet UI в `TelegramJurnalRabot`.

---

## 1. Базовый принцип

Для этого проекта новый UI нельзя внедрять напрямую в `main`.

Роли веток:
- `main` — основная ветка текущего приложения, которое продолжает тестироваться и стабилизироваться
- `feature/tablet-ui` — интеграционная ветка всей tablet UI переработки, которая развивается параллельно
- дочерние ветки от `feature/tablet-ui` — отдельные спринты, экраны, подзадачи и внеплановые улучшения

На текущем этапе нужно разделять два контура:
- основной тестовый контур приложения — из `main`
- контур нового tablet UI — отдельно: локально, preview-стендом или отдельной тестовой сборкой

Пока идёт активное тестирование текущего приложения, `feature/tablet-ui` не должна подменять собой основной тестовый сервер, который используется для проверки `main`.

---

## 2. Ветки для этого проекта

### 2.1 Основные ветки

- `main` — продакшен-стабильная линия
- `feature/tablet-ui` — основная ветка всех изменений по новому UI

### 2.2 Рекомендуемые рабочие ветки

Под спринты:
- `feature/tablet-ui-sprint-1-shell`
- `feature/tablet-ui-sprint-2-auth-home`
- `feature/tablet-ui-sprint-3-works-estimates`
- `feature/tablet-ui-sprint-4-schedule-acts`
- `feature/tablet-ui-sprint-5-source-data`
- `feature/tablet-ui-sprint-6-admin-qa`

Под отдельные задачи внутри спринтов:
- `feature/tablet-ui-header-nav`
- `feature/tablet-ui-safe-area`
- `feature/tablet-ui-worklog-table`
- `feature/tablet-ui-gantt-panel`
- `feature/tablet-ui-acts-export-form`

Под внеплановые улучшения, которые появились после тестов:
- `feature/tablet-ui-extra-button-acts`
- `feature/tablet-ui-new-screen-object-dashboard`
- `feature/tablet-ui-fix-telegram-main-button`

Под срочные исправления в новой UI-ветке:
- `fix/tablet-ui-safe-area-ios`
- `fix/tablet-ui-object-switch-dirty-state`

Под срочные исправления боевой версии:
- `hotfix/main-auth`
- `hotfix/main-schedule-export`

---

## 3. Откуда создавать ветки

### 3.1 Если работа относится к новому tablet UI

Создавать ветку от:

```bash
git checkout feature/tablet-ui
git pull --ff-only origin feature/tablet-ui
git checkout -b feature/tablet-ui-sprint-1-shell
```

### 3.2 Если это баг в стабильной версии

Создавать ветку от:

```bash
git checkout main
git pull --ff-only origin main
git checkout -b hotfix/main-some-fix
```

Так не смешиваются:
- стабильные исправления
- переработка tablet UI
- тестовые экспериментальные изменения

---

## 4. Порядок merge

### 4.1 Основной поток

Порядок работы:
1. `main` продолжает использоваться для текущего приложения и его тестирования
2. найденные по тестам баги текущего приложения исправляются сначала в `main`
3. после этого важные исправления переносятся из `main` в `feature/tablet-ui`
4. `feature/tablet-ui` живёт как параллельная интеграционная ветка нового UI
5. разработчик берёт UI-задачу и создаёт рабочую ветку от `feature/tablet-ui`
6. после завершения UI-задача вливается обратно в `feature/tablet-ui`
7. новый UI тестируется отдельно от основного `main`-контура
8. после завершения цикла разработки и приёмки `feature/tablet-ui` вливается в `main`

### 4.2 Практический merge flow

```bash
main
  ├── hotfix/main-*
  └── feature/tablet-ui
        ├── feature/tablet-ui-sprint-1-shell
        ├── feature/tablet-ui-sprint-2-auth-home
        ├── feature/tablet-ui-sprint-3-works-estimates
        ├── feature/tablet-ui-sprint-4-schedule-acts
        ├── feature/tablet-ui-sprint-5-source-data
        └── feature/tablet-ui-sprint-6-admin-qa
```

### 4.3 Правила merge

- рабочие ветки merge только в `feature/tablet-ui`
- direct commit в `main` не делать
- direct commit в `feature/tablet-ui` лучше избегать; использовать только для мелких служебных синхронизаций
- перед merge рабочая ветка должна быть синхронизирована с актуальной `feature/tablet-ui`
- каждый merge должен проходить ручную проверку UI на мобильном и планшетном breakpoint

### 4.4 Когда вливать `feature/tablet-ui` в `main`

Только когда одновременно выполнены условия:
- завершены ключевые спринты
- нет критических багов на тестовом сервере
- пройдены smoke-check сценарии Telegram + browser
- обновлены документы `docs/TZfrontend`
- согласована приёмка

До этого момента `main` и `feature/tablet-ui` считаются параллельными линиями работы.

---

## 5. Как синхронизировать ветки

### 5.1 Если в `main` нашли и исправили баг

Это основной сценарий на текущем этапе.

Порядок такой:
1. баг фиксится в отдельной ветке от `main`
2. исправление вливается в `main`
3. `main` деплоится в основной тестовый контур
4. только после этого фикс переносится в `feature/tablet-ui`

Пример:

```bash
git checkout main
git pull --ff-only origin main
git checkout -b hotfix/main-worklog-bug
```

После merge hotfix в `main`:

```bash
git checkout feature/tablet-ui
git pull --ff-only origin feature/tablet-ui
git merge origin/main
```

### 5.2 Если `main` получил важные изменения

Например:
- hotfix прод-ошибки
- важное backend-исправление
- auth/security fix

Тогда порядок такой:
1. изменения сначала стабилизируются в `main`
2. затем переносятся в `feature/tablet-ui`
3. затем обновляются активные UI-ветки

Пример:

```bash
git checkout feature/tablet-ui
git pull --ff-only origin feature/tablet-ui
git merge origin/main
```

Если есть активная рабочая ветка:

```bash
git checkout feature/tablet-ui-sprint-3-works-estimates
git merge feature/tablet-ui
```

### 5.3 Когда использовать `cherry-pick`, а когда `merge`

Использовать `merge main -> feature/tablet-ui`, если:
- в `main` накопилось несколько полезных исправлений
- нужна регулярная синхронизация новой UI-ветки с основной линией

Использовать `cherry-pick`, если:
- нужно забрать только один конкретный фикс
- в `main` есть другие изменения, которые пока не нужны в `feature/tablet-ui`

### 5.4 Что не делать

- не тащить несвязанные эксперименты из других веток в `feature/tablet-ui`
- не деплоить на тестовый сервер случайную локальную ветку без интеграции в `feature/tablet-ui`
- не исправлять баг текущего приложения только в `feature/tablet-ui`, если он воспроизводится в `main`

---

## 6. Правила деплоя на тестовый сервер

### 6.1 Что считается источником тестового сервера

На текущем этапе есть два режима:

Основной тестовый сервер:
- источник — `main`
- назначение — тестирование текущего рабочего приложения и hotfix

Отдельный контур tablet UI:
- источник — `feature/tablet-ui` или `release/tablet-ui-rc-*`
- назначение — тестирование нового UI без риска сломать основной тестовый цикл

Если отдельного стенда пока нет, новый UI тестируется:
- локально
- на preview URL
- на временном отдельном сервере

Не рекомендуется использовать один и тот же тестовый сервер попеременно то для `main`, то для `feature/tablet-ui`, пока `main` остаётся основной тестируемой линией.

### 6.2 Рекомендуемый режим работы

Для ежедневной разработки:
- разработка идёт в рабочих ветках
- merge в `feature/tablet-ui`
- новый UI проверяется в отдельном контуре, не мешая тестированию `main`

Для приёмочного тестирования:
- от `feature/tablet-ui` создаётся ветка-кандидат:

```bash
git checkout feature/tablet-ui
git checkout -b release/tablet-ui-rc-01
```

- на тестовый сервер выкатывается именно `release/tablet-ui-rc-01`
- в эту ветку больше не добавляются новые фичи, только fix

### 6.3 Правила тестового деплоя

- один деплой = одна понятная контрольная точка
- перед деплоем фиксируется:
  - ветка
  - commit SHA
  - список включённых задач
  - список известных ограничений
- если тестируется текущее приложение, деплой идёт из `main`
- если тестируется новый UI, деплой идёт только в отдельный UI-контур
- если тесты идут по конкретному спринту, лучше деплоить после merge этого спринта в `feature/tablet-ui`
- если идёт общий интеграционный прогон нового UI, лучше деплоить release-кандидата

### 6.4 Что нельзя деплоить на тестовый сервер

- незавершённую локальную ветку с непроверенными изменениями
- ветку, где смешаны unrelated задачи
- ветку, где не обновлены связанные ТЗ при появлении новых экранов/сценариев
- `feature/tablet-ui` вместо `main` в основной тестовый контур, если по `main` всё ещё идёт активное тестирование

---

## 7. Как поступать, если по тестам появляются новые кнопки или экраны

### 7.1 Если это мелкое UI-изменение

Примеры:
- добавить вторичную кнопку
- поменять текст CTA
- переставить блок
- скорректировать tablet layout

Действия:
1. записать как доработку текущего спринта или bugfix
2. создать небольшую ветку от `feature/tablet-ui`
3. внести изменение
4. проверить на мобильном и планшете
5. влить обратно в `feature/tablet-ui`

### 7.2 Если это новый экран или новый flow

Примеры:
- новая страница
- новый раздел навигации
- новый мастер
- новый полноэкранный режим

Действия:
1. сначала обновить ТЗ в `docs/TZfrontend`
2. определить, это входит в текущий sprint scope или это post-MVP
3. создать отдельную ветку под новую задачу
4. реализовать и тестировать отдельно
5. только потом вливать в `feature/tablet-ui`

Рекомендуемые названия:
- `feature/tablet-ui-new-screen-...`
- `feature/tablet-ui-new-flow-...`

### 7.3 Если изменение влияет на архитектуру

Примеры:
- новый navigation pattern
- изменение shell
- новый глобальный state flow
- изменение логики переключения объекта

Действия:
1. не вносить сразу в код
2. сначала обновить `strateg.md` и/или релевантный файл ТЗ
3. согласовать влияние на уже идущие спринты
4. только после этого создавать реализацию

---

## 8. Рекомендуемый рабочий цикл разработчика

### 8.1 Для обычной задачи

```bash
git checkout feature/tablet-ui
git pull --ff-only origin feature/tablet-ui
git checkout -b feature/tablet-ui-worklog-table
```

После завершения:
1. локальная проверка
2. проверка на мобильном breakpoint
3. проверка на tablet breakpoint
4. merge в `feature/tablet-ui`
5. деплой `feature/tablet-ui` только в отдельный UI-контур или preview

### 8.2 Для багов текущего приложения

```bash
git checkout main
git pull --ff-only origin main
git checkout -b hotfix/main-some-bug
```

После завершения:
1. merge в `main`
2. деплой `main` в основной тестовый сервер
3. перенос нужного фикса в `feature/tablet-ui`

### 8.3 Для контрольной приёмки нового UI

```bash
git checkout feature/tablet-ui
git pull --ff-only origin feature/tablet-ui
git checkout -b release/tablet-ui-rc-01
```

Дальше:
- деплой release-ветки
- сбор замечаний
- исправления отдельными `fix/tablet-ui-*`
- merge fix в `release/...`
- затем перенос fix обратно в `feature/tablet-ui`

---

## 9. Правила фиксации изменений в документации

При любом из случаев нужно обновлять документацию:
- появился новый экран
- появился новый сценарий
- изменилась логика навигации
- изменилась логика Telegram MainButton / BackButton
- изменилась логика работы с объектами

Минимум обновлений:
- соответствующий файл в `docs/TZfrontend`
- при необходимости `docs/TZfrontend/README.md`
- `docs/changelog.md`
- `docs/tasktracker.md`

---

## 10. Рекомендуемая схема для твоего проекта

На практике для `TelegramJurnalRabot` рекомендую так:

1. Основная ветка разработки нового UI:
   - `feature/tablet-ui`

2. Текущая линия тестирования основного приложения:
   - `main`
   - `hotfix/main-*` для найденных багов

3. Работать по спринтам:
   - `feature/tablet-ui-sprint-1-shell`
   - `feature/tablet-ui-sprint-2-auth-home`
   - `feature/tablet-ui-sprint-3-works-estimates`
   - `feature/tablet-ui-sprint-4-schedule-acts`
   - `feature/tablet-ui-sprint-5-source-data`
   - `feature/tablet-ui-sprint-6-admin-qa`

4. Основной тестовый сервер:
   - только `main`, пока идёт активное тестирование текущего приложения

5. Контур нового UI:
   - `feature/tablet-ui` для повседневной проверки
   - `release/tablet-ui-rc-*` для стабильного цикла приёмки

6. Продакшен:
   - только из `main`

7. Все новые идеи из тестов делить на 3 типа:
   - `fix` — баги и мелкие UI-правки
   - `feature` — новые экраны и сценарии
   - `defer` — идеи, которые уходят в post-MVP

---

## 11. Короткий ответ

Да, для этого проекта правильно работать так:
- создать `feature/tablet-ui`
- все tablet UI задачи делать от неё в отдельных дочерних ветках
- баги текущего приложения сначала исправлять в `main`
- основной тестовый сервер пока держать на `main`
- новый UI тестировать отдельно: из `feature/tablet-ui` или `release/tablet-ui-rc-*`
- `main` не использовать для разработки нового UI
- новые кнопки и экраны, появившиеся по итогам тестов, сначала классифицировать и при необходимости вносить в ТЗ, а затем делать отдельной веткой

Это даст:
- стабильный `main`
- предсказуемый тестовый контур
- понятную историю изменений
- управляемое внедрение нового UI без хаоса
