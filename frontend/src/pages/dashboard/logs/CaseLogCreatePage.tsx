import { useParams } from 'react-router'

import { CaseLogCreateForm } from '@/features/cases/components/CaseLogCreateForm'

export function CaseLogCreatePage() {
  const { id } = useParams<{ id: string }>()
  return <CaseLogCreateForm caseId={id!} />
}

export default CaseLogCreatePage
