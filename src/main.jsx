import { createRoot } from "react-dom/client";
import React from 'react';
import App from "./App.jsx";
import "./index.css";

// 创建根节点并渲染应用
const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('[Main] Root element not found!');
} else {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
