import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useLanguageStore, translations } from "@/lib/i18n";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";

export default function Settings() {
  const { language, setLanguage } = useLanguageStore();
  const t = translations[language].settings;

  return (
    <div className="flex flex-col min-h-screen bg-background bg-grain">
      <Header title={t.title} />
      
      <div className="flex-1 p-4 space-y-4 max-w-md mx-auto w-full">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t.language}</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={language}
              onValueChange={(val: 'en' | 'ru') => setLanguage(val)}
              className="space-y-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="en" id="en" />
                <Label htmlFor="en" className="text-base cursor-pointer">
                  {t.en}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ru" id="ru" />
                <Label htmlFor="ru" className="text-base cursor-pointer">
                  {t.ru}
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
}
