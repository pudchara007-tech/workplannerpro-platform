import PersonalCockpit from "./PersonalCockpit";

export default function PersonalPage() {
  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold mb-1">☀️ ส่วนตัว</h1>
      <p className="text-gray-400 mb-6">เป้าหมาย นิสัย และโฟกัสของวันนี้</p>
      <PersonalCockpit />
    </div>
  );
}
