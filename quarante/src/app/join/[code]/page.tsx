import JoinForm from "@/components/JoinForm";
export default function Page({ params }: { params: { code: string } }) {
  return <JoinForm initialCode={params.code} />;
}
