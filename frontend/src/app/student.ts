import { Student } from "./student-types";

export const useStudent = (): Student => {
  const [student, setStudent] = useState<Student>({
    id: "",
    name: "",
    email: "",
    curriculo: {
      lattesUrl: "",
      possuiCurriculo: false,
    },
  });

  const updateLattesUrl = async (url: string) => {
    // Chamada para o endpoint PUT /api/alunos/me/curriculo/lattes
    const response = await fetch("/api/alunos/me/curriculo/lattes", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ lattesUrl: url }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Erro ao atualizar URL do Lattes");
    }

    setStudent((prev) => ({
      ...prev,
      curriculo: { ...prev.curriculo, lattesUrl: url },
    }));
  };

  const deleteLattesUrl = async () => {
    // Chamada para o endpoint DELETE /api/alunos/me/curriculo/lattes
    const response = await fetch("/api/alunos/me/curriculo/lattes", {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Erro ao remover URL do Lattes");
    }

    setStudent((prev) => ({
      ...prev,
      curriculo: { ...prev.curriculo, lattesUrl: "" },
    }));
  };

  return { student, updateLattesUrl, deleteLattesUrl };
};