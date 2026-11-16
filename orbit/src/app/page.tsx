import OrbitApp from "@/features/orbit/components/OrbitApp";
export default function Page() {
  return <OrbitApp preview={process.env.ORBIT_PREVIEW_EXPORT === "1"} />;
}
