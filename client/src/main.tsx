import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();
tg?.disableVerticalSwipes();

createRoot(document.getElementById("root")!).render(<App />);
