// App frame, modelled on Acrobat: Home (side menu), All tools, document view with tabs.
// URLs:  /  /tools  /recent  /coverage          Home pages (side menu)
//        /doc/:fileId?tool=<id>&ai=1             a document, optionally with a tool or the AI panel open
//        /pick/:toolId                           choose a file for a tool started from Home
//        /tool/:toolId                           setup-page tools (Combine, Compare, Create)
//        tool routes                             from tools/*.tsx (Agreements, Spaces, Profile, signing page...)
import { Link, Route, Routes } from "react-router-dom";
import Coverage from "./Coverage";
import { HomeFrame, ToastHost, TopBar } from "./shell/chrome";
import DocumentView from "./shell/DocumentView";
import { AllToolsPage, HomePage, PickFilePage, RecentPage, ToolPage } from "./shell/pages";
import { FrameProvider, useFrame } from "./shell/state";
import { toolRoutes } from "./tools/registry";

function Framed({ children }: { children: React.ReactNode }) {
  const { serverDown } = useFrame();
  return (
    <>
      <TopBar />
      {serverDown && (
        <div className="banner">Can't reach the Fill Me server. Start it with <code>uvicorn app.main:app</code> on port 8000, then reload.</div>
      )}
      {children}
      <ToastHost />
    </>
  );
}

function CoveragePage() {
  const { tools } = useFrame();
  return <Coverage tools={tools} />;
}

export default function App() {
  const home = (el: React.ReactNode) => <Framed><HomeFrame>{el}</HomeFrame></Framed>;
  return (
    <FrameProvider>
      <Routes>
        <Route path="/" element={home(<HomePage />)} />
        <Route path="/tools" element={home(<AllToolsPage />)} />
        <Route path="/recent" element={home(<RecentPage />)} />
        <Route path="/coverage" element={home(<CoveragePage />)} />
        <Route path="/doc/:fileId" element={<Framed><DocumentView /></Framed>} />
        <Route path="/pick/:toolId" element={<Framed><PickFilePage /></Framed>} />
        <Route path="/tool/:toolId" element={<Framed><ToolPage /></Framed>} />
        {toolRoutes.map((r) => (
          <Route key={r.path} path={r.path} element={r.frame === "home" ? home(r.element) : r.element} />
        ))}
        <Route path="*" element={home(<div className="empty-state">Page not found. <Link to="/">Go to Home</Link></div>)} />
      </Routes>
    </FrameProvider>
  );
}
