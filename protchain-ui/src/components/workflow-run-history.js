import React from 'react';

const WorkflowRunHistory = ({ runs }) => {
  if (!runs || runs.length === 0) {
    return <p>No run history available for this workflow.</p>;
  }

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold mb-4">Run History</h2>
      <ul className="space-y-4">
        {runs.map((run) => (
          <li key={run.ID} className="p-4 border rounded-lg shadow-sm">
            <div className="flex justify-between">
              <span className={`px-2 py-1 text-sm font-semibold rounded-full ${run.Status === 'COMPLETED' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>
                {run.Status}
              </span>
              <span className="text-sm text-gray-500">{new Date(run.StartedAt).toLocaleString()}</span>
            </div>
            <div className="mt-2 text-sm text-gray-700">
              <p>Run ID: {run.ID}</p>
              {run.CompletedAt && <p>Completed: {new Date(run.CompletedAt.Time).toLocaleString()}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default WorkflowRunHistory;
