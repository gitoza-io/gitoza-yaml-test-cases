import { useEffect, useState } from "react";
import { getInitPayload, onInit } from "../api/vscodeApi";

export function useGitUserName(_gitProfileVersion = 0) {
  const [name, setName] = useState(() => getInitPayload()?.gitUserName ?? "");

  useEffect(() => {
    return onInit((init) => {
      setName(init.gitUserName ?? "");
    });
  }, []);

  return name;
}
