"use client";
import { FirePanel3D } from "@/components/cockpit/fire-panel-3d";

export default function FirePanel3DPage() {
  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <FirePanel3D
        fireDetected={false}
        firePbDone={false}
        agent1Disch={false}
        agent2Disch={false}
        onPushFirePb={() => {}}
        onPushAgent1={() => {}}
        onPushAgent2={() => {}}
      />
    </div>
  );
}
