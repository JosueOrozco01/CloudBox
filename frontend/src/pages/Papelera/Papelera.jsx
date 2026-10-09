import FileBrowser from "../../components/FileBrowser/FileBrowser";
import "./Papelera.css";

export default function Papelera({ user }) {
  return <FileBrowser user={user} trash />;
}
