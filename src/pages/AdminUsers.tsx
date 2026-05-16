import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { adminService } from "@/services/admin.service";

export function AdminUsers() {
  const { data = [] } = useQuery({ queryKey: ["admin-users"], queryFn: () => adminService.getUsers() });
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const rows = data.filter((row) => {
    const value = deferredQuery.toLowerCase();
    return row.name.toLowerCase().includes(value) || row.email.toLowerCase().includes(value);
  });

  return (
    <section className="page">
      <div className="section-header">
        <div>
          <div className="section-kicker">Utilisateurs</div>
          <h1 className="page-title">Comptes, rôles et conformité</h1>
        </div>
        <div className="user-chip">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un utilisateur" style={{ border: 0, background: "transparent", outline: "none" }} />
        </div>
      </div>

      <article className="panel">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Rôle</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.email}</td>
                <td><span className="badge">{row.role}</span></td>
                <td><span className={`pill status-${row.status}`}>{row.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  );
}