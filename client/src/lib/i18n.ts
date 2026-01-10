import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Language = 'en' | 'ru';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'ru', // Default to Russian as requested
      setLanguage: (lang) => set({ language: lang }),
    }),
    {
      name: 'language-storage',
    }
  )
);

export const translations = {
  en: {
    nav: {
      home: 'Home',
      works: 'Works',
      worklog: 'Work Log',
      acts: 'Acts',
      settings: 'Settings'
    },
    home: {
      title: 'Work Log',
      placeholder: 'Type your work message here...',
      send: 'Send',
      processing: 'Processing...',
      noMessages: 'No messages yet. Start by logging your work!'
    },
    works: {
      title: 'Bill of Quantities',
      code: 'Code',
      description: 'Description',
      unit: 'Unit',
      quantity: 'Total Quantity',
      importExcel: 'Import Excel',
      importSuccess: 'Imported {count} items successfully',
      importError: 'Failed to import Excel'
    },
    acts: {
      title: 'Acts (AOSR)',
      generate: 'Generate New Act',
      dateRange: 'Date Range',
      status: 'Status',
      location: 'Location',
      view: 'View'
    },
    worklog: {
      title: 'General Work Log',
      subtitle: 'Section 5 - Construction Control',
      rowNumber: 'No.',
      date: 'Date',
      workDescription: 'Work Description',
      quantity: 'Qty',
      unit: 'Unit',
      location: 'Location',
      notes: 'Notes',
      noRecords: 'No work records yet',
      noRecordsHint: 'Send work messages to populate this log',
      status: 'Status',
      processed: 'Processed',
      pending: 'Pending',
      exportPdf: 'Export PDF',
      rdStandard: 'RD-11-05-2007'
    },
    settings: {
      title: 'Settings',
      language: 'Language',
      en: 'English',
      ru: 'Russian'
    }
  },
  ru: {
    nav: {
      home: 'Главная',
      works: 'ВОИР',
      worklog: 'ЖР',
      acts: 'Акты',
      settings: 'Настройки'
    },
    home: {
      title: 'Журнал работ',
      placeholder: 'Введите сообщение о работе...',
      send: 'Отправить',
      processing: 'Обработка...',
      noMessages: 'Нет сообщений. Начните с записи работы!'
    },
    works: {
      title: 'Ведомость объемов (ВОИР)',
      code: 'Код',
      description: 'Описание',
      unit: 'Ед. изм.',
      quantity: 'Общий объем',
      importExcel: 'Импорт Excel',
      importSuccess: 'Успешно импортировано {count} позиций',
      importError: 'Ошибка импорта Excel'
    },
    acts: {
      title: 'Акты (АОСР)',
      generate: 'Создать новый акт',
      dateRange: 'Период',
      status: 'Статус',
      location: 'Участок',
      view: 'Открыть'
    },
    worklog: {
      title: 'Общий журнал работ',
      subtitle: 'Раздел 5 - Строительный контроль',
      rowNumber: '№',
      date: 'Дата',
      workDescription: 'Наименование работ',
      quantity: 'Кол-во',
      unit: 'Ед. изм.',
      location: 'Участок',
      notes: 'Примечание',
      noRecords: 'Записи отсутствуют',
      noRecordsHint: 'Отправляйте сообщения о работах для заполнения журнала',
      status: 'Статус',
      processed: 'Обработано',
      pending: 'В обработке',
      exportPdf: 'Экспорт PDF',
      rdStandard: 'РД-11-05-2007'
    },
    settings: {
      title: 'Настройки',
      language: 'Язык',
      en: 'English (En)',
      ru: 'Русский (Ru)'
    }
  }
};
