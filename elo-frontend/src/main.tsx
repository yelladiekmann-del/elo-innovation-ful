import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import JoinPage from "./pages/JoinPage";
import VotePage from "./pages/VotePage";
import AdminPage from "./pages/AdminPage";
import FilterApp from "./pages/FilterApp";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<JoinPage />} />
        <Route path="/filter" element={<FilterApp />} />
        <Route path="/vote/:token" element={<VotePage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
