import { useQuery } from "@tanstack/react-query";
import { formatUsd } from "@/lib/utils";
import { adminService } from "@/services/admin.service";

export function AdminTransactions() {
  const { data = [] } = useQuery({ queryKey: ["admin-transactions"], queryFn: () => adminService.getTransactions() });

  return (
    <section className="page">
      <div>
        <div className="section-kicker">Transactions</div>
        <h1 className="page-title">Journal financier</h1>
        <p className="page-copy">Vue stub pour le monitoring des entrées, sorties et exceptions de paiement.</p>
      </div>

      <article className="panel">
        <table>
          <thead>
            <tr>
              <th>Référence</th>
              <th>Description</th>
              <th>Montant</th>
              <th>Date</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>{row.description}</td>
                <td>{formatUsd(row.amountUsd)}</td>
                <td>{row.createdAt}</td>
                <td><span className={`pill status-${row.status}`}>{row.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  );
}