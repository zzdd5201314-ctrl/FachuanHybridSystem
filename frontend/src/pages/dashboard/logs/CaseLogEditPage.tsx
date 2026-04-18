import { useParams } from 'react-router'

import { CaseLogEditForm } from '@/features/cases/components/CaseLogEditForm'

export function CaseLogEditPage() {
  const { caseId, logId } = useParams<{ caseId: string; logId: string }>()
  return <CaseLogEditForm caseId={caseId!} logId={logId!} />
}

export default CaseLogEditPage
