import { useEffect } from "react";
import InstrumentalsSidebar from "@/components/studio/InstrumentalsSidebar";

const StudioMusic = () => {
  useEffect(() => {
    // Hide any scrollbars on the body when this page is mounted
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full bg-background">
      {/* Instrumentals Sidebar */}
      <InstrumentalsSidebar />
      
      {/* DAW iframe */}
      <iframe
        src="https://ai.studio/apps/drive/1OsVLD_D3GihuTWMOpM_qdfmYpQjux-B5"
        className="w-full h-full border-0"
        style={{
          border: 'none',
          margin: 0,
          padding: 0,
          overflow: 'hidden',
        }}
        allow="autoplay; microphone; fullscreen"
        title="Studio Music DAW"
      />
    </div>
  );
};

export default StudioMusic;
