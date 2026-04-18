import { useParams } from 'react-router'

import { CaseLogBoard } from '@/features/cases/components/CaseLogBoard'

export function CaseLogBoardPage() {
  const { id } = useParams<{ id: string }>()
  return <CaseLogBoard caseId={id!} />
}

export default CaseLogBoardPage
