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
      description: 'Work Description',
      unit: 'Unit',
      quantity: 'Qty',
      rowNumber: 'No.',
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
      tabs: {
        title: 'Title',
        section1: 'Section 1',
        section2: 'Section 2',
        section3: 'Section 3',
        section4: 'Section 4',
        section5: 'Section 5',
        section6: 'Section 6'
      },
      section1: {
        title: 'SECTION 1',
        subtitle: 'List of engineering and technical personnel of the person carrying out construction, reconstruction, major repairs, engaged in the construction, reconstruction, major repairs of the capital construction facility',
        rowNumber: 'No.',
        orgName: 'Full and (or) abbreviated name or surname, first name, patronymic (if any) of the person carrying out construction, reconstruction, major repairs',
        personInfo: 'Surname, initials, position (if any) of the person included in the list of engineering and technical personnel',
        startDate: 'Start date of work at the capital construction facility with indication of the type of work',
        endDate: 'End date of work at the capital construction facility',
        representative: 'Position (if any), surname, initials, signature of the authorized representative of the person carrying out construction, reconstruction, major repairs'
      },
      section3: {
        title: 'SECTION 3',
        subtitle: 'Information on work performed during construction, reconstruction, major repairs of capital construction facility',
        rowNumber: 'No.',
        date: 'Date of work',
        workConditions: 'Work conditions',
        workDescription: 'Name of works performed during construction, reconstruction, major repairs with indication of axes, rows, elevations, floors, tiers, sections, premises where works were performed, information on methods of work execution, used construction materials, products and structures, tested structures, equipment, systems and devices (energization under load, pressure supply, testing for strength and tightness)',
        representative: 'Position (if any), surname, initials, signature of authorized representative of the person carrying out construction, major repairs'
      },
      noRecords: 'No work records yet',
      noRecordsHint: 'Send work messages to populate this log',
      refreshLog: 'Refresh log',
      comingSoon: 'Coming soon'
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
      works: 'ВОР',
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
      title: 'Ведомость объемов работ',
      code: '№ в ЛСР',
      description: 'Наименование работ',
      unit: 'Ед. изм.',
      quantity: 'Кол-во',
      rowNumber: '№',
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
      tabs: {
        title: 'Титул',
        section1: 'Раздел 1',
        section2: 'Раздел 2',
        section3: 'Раздел 3',
        section4: 'Раздел 4',
        section5: 'Раздел 5',
        section6: 'Раздел 6'
      },
      section1: {
        title: 'РАЗДЕЛ 1',
        subtitle: 'Список инженерно-технического персонала лица, осуществляющего строительство, реконструкцию, капитальный ремонт, занятого при строительстве, реконструкции, капитальном ремонте объекта капитального строительства',
        rowNumber: '№ п/п',
        orgName: 'Полное и (или) сокращенное наименование или фамилия, имя отчество (последнее - при наличии) лица, осуществляющего строительство, реконструкцию, капитальный ремонт',
        personInfo: 'Фамилия, инициалы, должность (при наличии) лица, входящего в список инженерно-технического персонала',
        startDate: 'Дата начала работ на объекте капитального строительства с указанием вида работ',
        endDate: 'Дата окончания работ на объекте капитального строительства',
        representative: 'Должность (при наличии), фамилия, инициалы, подпись уполномоченного представителя лица, осуществляющего строительство, реконструкцию, капитальный ремонт'
      },
      section3: {
        title: 'РАЗДЕЛ 3',
        subtitle: 'Сведения о выполнении работ в процессе строительства, реконструкции, капитального ремонта объекта капитального строительства',
        rowNumber: '№ п/п',
        date: 'Дата выполнения работ',
        workConditions: 'Условия производства работ',
        workDescription: 'Наименование работ, выполняемых в процессе строительства, реконструкции, капитального ремонта объекта капитального строительства с указанием осей, рядов, отметок, этажей, ярусов, секций, помещений, в которых выполнялись работы, сведения о методах выполнения работ, применяемых строительных материалах, изделиях и конструкциях, проведенных испытаниях конструкций, оборудования, систем, сетей и устройств (опробование вхолостую или под нагрузкой, подача электроэнергии, давления, испытания на прочность и герметичность)',
        representative: 'Должность (при наличии), фамилия, инициалы, подпись уполномоченного представителя лица, осуществляющего строительство, капитальный ремонт'
      },
      noRecords: 'Записи отсутствуют',
      noRecordsHint: 'Отправляйте сообщения о работах для заполнения журнала',
      refreshLog: 'Обновить журнал',
      comingSoon: 'В разработке'
    },
    settings: {
      title: 'Настройки',
      language: 'Язык',
      en: 'English (En)',
      ru: 'Русский (Ru)'
    }
  }
};
