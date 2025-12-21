import { useEffect } from "react";
import InstrumentalsSidebar from "@/components/studio/InstrumentalsSidebar";
import TransferZone from "@/components/studio/TransferZone";

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
      
      {/* Transfer Zone for WAV files */}
      <TransferZone />
      
      {/* DAW iframe */}
      <iframe
        src="https://nova-daw-pro-audio-workstation-418728368474.us-west1.run.app/"
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
