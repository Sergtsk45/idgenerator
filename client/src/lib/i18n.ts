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
      section2: {
        title: 'SECTION 2',
        subtitle: 'List of special journals in which records of work performed are kept, as well as supervision journals of the person preparing the design documentation',
        rowNumber: 'No.',
        journalName: 'Name of the special journal (supervision journal) and date of its issue',
        personInfo: 'Full and (or) abbreviated name or surname, first name, patronymic (if any) of the person carrying out construction, reconstruction, major repairs (the person preparing the design documentation), keeping the journal, their authorized representatives with indication of position (if any), surname, initials',
        transferDate: 'Date of transfer to the developer or customer of the journal',
        signature: 'Signature of the authorized representative of the developer or technical customer, person responsible for operation of the building, structure, and (or) regional operator'
      },
      section4: {
        title: 'SECTION 4',
        subtitle: 'Information on construction control during construction, reconstruction, major repairs of capital construction facility',
        rowNumber: 'No.',
        controlInfo: 'Information on construction control during construction, reconstruction, major repairs of capital construction facility',
        defects: 'Identified defects',
        defectDeadline: 'Deadline for elimination of identified defects',
        controlSignature: 'Position (if any), surname, initials, signature of authorized representative of developer or technical customer, person responsible for operation of building, structure, and (or) regional operator on construction control matters',
        defectFixDate: 'Date of defect elimination',
        fixSignature: 'Position (if any), surname, initials, signature of authorized representative of developer or technical customer, person responsible for operation of building, structure, and (or) regional operator on construction control matters'
      },
      section5: {
        title: 'SECTION 5',
        subtitle: 'List of executive documentation during construction, reconstruction, major repairs of capital construction facility',
        rowNumber: 'No.',
        docName: 'Name of executive documentation (indicating type of work, location of structures, sections of utility networks, etc.)',
        signatureInfo: 'Date of signing the act, positions, surnames, initials of persons who signed the acts'
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
      comingSoon: 'Coming soon',
      actions: {
        edit: 'Edit',
        save: 'Save',
        search: 'Search'
      }
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
      section2: {
        title: 'РАЗДЕЛ 2',
        subtitle: 'Перечень специальных журналов, в которых ведется учет выполнения работ, а также журналов авторского надзора лица, осуществляющего подготовку проектной документации',
        rowNumber: '№ п/п',
        journalName: 'Наименование специального журнала (журнала авторского надзора) и дата его выдачи',
        personInfo: 'Полное и (или) сокращенное наименование или фамилия, имя, отчество (при наличии) лица, осуществляющего строительство, реконструкцию, капитальный ремонт (лица, осуществляющего подготовку проектной документации), ведущих журнал, их уполномоченных представителей с указанием должности (при наличии), фамилии, инициалов',
        transferDate: 'Дата передачи застройщику или заказчику журнала',
        signature: 'Подпись уполномоченного представителя застройщика или технического заказчика, лица, ответственного за эксплуатацию здания, сооружения, и (или) регионального оператора'
      },
      section4: {
        title: 'РАЗДЕЛ 4',
        subtitle: 'Сведения о строительном контроле в процессе строительства, реконструкции, капитального ремонта объекта капитального строительства',
        rowNumber: '№ п/п',
        controlInfo: 'Сведения о проведении строительного контроля при строительстве, реконструкции, капитальном ремонте объекта капитального строительства',
        defects: 'Выявленные недостатки',
        defectDeadline: 'Срок устранения выявленных недостатков',
        controlSignature: 'Должность (при наличии), фамилия, инициалы, подпись уполномоченного представителя застройщика или технического заказчика, лица, ответственного за эксплуатацию здания, сооружения, и (или) регионального оператора по вопросам строительного контроля',
        defectFixDate: 'Дата устранения недостатков',
        fixSignature: 'Должность (при наличии), фамилия, инициалы, подпись уполномоченного представителя застройщика или технического заказчика, лица, ответственного за эксплуатацию здания, сооружения, и(или) регионального оператора по вопросам строительного контроля'
      },
      section5: {
        title: 'РАЗДЕЛ 5',
        subtitle: 'Перечень исполнительной документации при строительстве, реконструкции, капитальном ремонте объекта капитального строительства',
        rowNumber: '№ п/п',
        docName: 'Наименование исполнительной документации (с указанием вида работ, места расположения конструкций, участков сетей инженерно – технического обеспечения и т.д.)',
        signatureInfo: 'Дата подписания акта, должности, фамилии, инициалы лиц, подписавших акты'
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
      comingSoon: 'В разработке',
      actions: {
        edit: 'Редактировать',
        save: 'Сохранить',
        search: 'Поиск'
      }
    },
    settings: {
      title: 'Настройки',
      language: 'Язык',
      en: 'English (En)',
      ru: 'Русский (Ru)'
    }
  }
};
