import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router'
import { Eye, EyeOff, FileText, Loader2, Save, Upload, X, Camera } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { useLawyer } from '../hooks/use-lawyer'
import { useLawyerMutations } from '../hooks/use-lawyer-mutations'
import { useLawFirms } from '../hooks/use-lawfirms'
import { generatePath } from '@/routes/paths'
import { resolveMediaUrl } from '@/lib/api'
import type { FormMode } from '../types'

export interface LawyerFormProps {
  lawyerId?: string | number
  mode: FormMode
}

const lawyerFormSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string(),
  real_name: z.string(),
  phone: z.string(),
  license_no: z.string(),
  id_card: z.string(),
  law_firm_id: z.string(),
  is_admin: z.boolean(),
})

type LawyerFormData = z.infer<typeof lawyerFormSchema>

export function LawyerForm({ lawyerId, mode }: LawyerFormProps) {
  const navigate = useNavigate()
  const isEditMode = mode === 'edit'

  const [showPassword, setShowPassword] = useState(false)
  const [licensePdf, setLicensePdf] = useState<File | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const {
    data: lawyer,
    isLoading: isLoadingLawyer,
    error: lawyerError,
  } = useLawyer(lawyerId?.toString() || '')

  const { data: lawFirms, isLoading: isLoadingLawFirms } = useLawFirms()
  const { createLawyer, updateLawyer } = useLawyerMutations()

  const form = useForm<LawyerFormData>({
    resolver: zodResolver(lawyerFormSchema),
    defaultValues: {
      username: '',
      password: '',
      real_name: '',
      phone: '',
      license_no: '',
      id_card: '',
      law_firm_id: '',
      is_admin: false,
    },
  })

  useEffect(() => {
    if (isEditMode && lawyer) {
      form.reset({
        username: lawyer.username,
        password: '',
        real_name: lawyer.real_name || '',
        phone: lawyer.phone || '',
        license_no: lawyer.license_no || '',
        id_card: lawyer.id_card || '',
        law_firm_id: lawyer.law_firm?.toString() || '',
        is_admin: lawyer.is_admin,
      })
      if (lawyer.avatar_url) {
        setAvatarPreview(resolveMediaUrl(lawyer.avatar_url))
      }
    }
  }, [isEditMode, lawyer, form])

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('头像大小不能超过 5MB')
      return
    }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleRemoveAvatar = () => {
    setAvatarFile(null)
    setAvatarPreview(null)
    if (avatarInputRef.current) avatarInputRef.current.value = ''
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('请选择 PDF 文件')
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('文件大小不能超过 10MB')
        return
      }
      setLicensePdf(file)
    }
  }

  const handleClearFile = () => {
    setLicensePdf(null)
  }

  const onSubmit = (data: LawyerFormData) => {
    if (!isEditMode && (!data.password || data.password.length < 6)) {
      form.setError('password', { type: 'manual', message: '密码至少6位' })
      return
    }

    const submitData = {
      username: data.username,
      real_name: data.real_name || undefined,
      phone: data.phone || undefined,
      license_no: data.license_no || undefined,
      id_card: data.id_card || undefined,
      law_firm_id: data.law_firm_id ? Number(data.law_firm_id) : undefined,
      is_admin: data.is_admin,
    }

    if (isEditMode && lawyerId) {
      const updateData = { ...submitData, password: data.password || undefined }
      updateLawyer.mutate(
        {
          id: Number(lawyerId),
          data: updateData,
          licensePdf: licensePdf || undefined,
          avatar: avatarFile || undefined,
        },
        {
          onSuccess: (updatedLawyer) => {
            toast.success('保存成功')
            navigate(generatePath.lawyerDetail(updatedLawyer.id))
          },
          onError: (error) => {
            toast.error(error instanceof Error ? error.message : '保存失败，请重试')
          },
        }
      )
    } else {
      const createData = { ...submitData, password: data.password }
      createLawyer.mutate(
        {
          data: createData,
          licensePdf: licensePdf || undefined,
          avatar: avatarFile || undefined,
        },
        {
          onSuccess: (createdLawyer) => {
            toast.success('创建成功')
            navigate(generatePath.lawyerDetail(createdLawyer.id))
          },
          onError: (error) => {
            toast.error(error instanceof Error ? error.message : '创建失败，请重试')
          },
        }
      )
    }
  }

  const handleCancel = () => navigate(-1)

  if (isEditMode && isLoadingLawyer) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground size-8 animate-spin" />
      </div>
    )
  }

  if (isEditMode && lawyerError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-destructive mb-4">加载律师数据失败</p>
        <Button variant="outline" onClick={() => navigate(-1)}>返回</Button>
      </div>
    )
  }

  const isPending = createLawyer.isPending || updateLawyer.isPending

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isEditMode ? '编辑律师信息' : '律师信息'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Avatar upload */}
              <div className="flex items-center gap-5">
                <div
                  className="group relative size-20 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-border hover:border-primary/50"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="头像" className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-muted">
                      <Camera className="size-7 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Upload className="size-5 text-white" />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">律师头像</div>
                  <div className="text-xs text-muted-foreground">支持 JPG、PNG 格式，最大 5MB</div>
                  {avatarPreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={handleRemoveAvatar}
                      disabled={isPending}
                    >
                      <X className="mr-1 size-3" />移除头像
                    </Button>
                  )}
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarSelect}
                  disabled={isPending}
                />
              </div>

              {/* Form fields - 2 column grid */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>用户名 <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="请输入用户名" disabled={isPending || isEditMode} className="h-10" {...field} />
                      </FormControl>
                      <FormMessage />
                      {isEditMode && <FormDescription>编辑模式下用户名不可修改</FormDescription>}
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>密码 {!isEditMode && <span className="text-destructive">*</span>}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder={isEditMode ? '留空表示不修改密码' : '请输入密码（至少6位）'}
                            disabled={isPending}
                            className="h-10 pr-10"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-10 px-3 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="text-muted-foreground size-4" /> : <Eye className="text-muted-foreground size-4" />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="real_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>真实姓名</FormLabel>
                      <FormControl>
                        <Input placeholder="请输入真实姓名" disabled={isPending} className="h-10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>手机号</FormLabel>
                      <FormControl>
                        <Input placeholder="请输入手机号" type="tel" disabled={isPending} className="h-10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="license_no"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>执业证号</FormLabel>
                      <FormControl>
                        <Input placeholder="请输入执业证号" disabled={isPending} className="h-10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="id_card"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>身份证号</FormLabel>
                      <FormControl>
                        <Input placeholder="请输入身份证号" disabled={isPending} className="h-10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="law_firm_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>所属律所</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isPending || isLoadingLawFirms}>
                        <FormControl>
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue placeholder="请选择所属律所" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {lawFirms?.map((firm) => (
                            <SelectItem key={firm.id} value={firm.id.toString()}>{firm.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_admin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>是否管理员</FormLabel>
                      <FormControl>
                        <div className="flex h-10 items-center">
                          <label className="relative inline-flex cursor-pointer items-center">
                            <input
                              type="checkbox"
                              className="peer sr-only"
                              checked={field.value}
                              onChange={field.onChange}
                              disabled={isPending}
                            />
                            <div className="peer bg-muted peer-checked:bg-primary peer-focus:ring-ring h-6 w-11 rounded-full after:absolute after:left-[2px] after:top-[2px] after:size-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-2 peer-focus:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50" />
                            <span className="text-muted-foreground ml-3 text-sm">{field.value ? '是' : '否'}</span>
                          </label>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* License PDF upload */}
              <div className="space-y-2">
                <FormLabel>执业证 PDF</FormLabel>
                <div className="flex flex-col gap-3">
                  {licensePdf && (
                    <div className="bg-muted flex items-center gap-2 rounded-md p-3">
                      <FileText className="text-muted-foreground size-5" />
                      <span className="flex-1 truncate text-sm">{licensePdf.name}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={handleClearFile} disabled={isPending}>
                        <X className="size-4" />
                      </Button>
                    </div>
                  )}
                  {isEditMode && lawyer?.license_pdf_url && !licensePdf && (
                    <div className="bg-muted flex items-center gap-2 rounded-md p-3">
                      <FileText className="text-muted-foreground size-5" />
                      <a href={resolveMediaUrl(lawyer.license_pdf_url) ?? undefined} target="_blank" rel="noopener noreferrer" className="text-primary flex-1 truncate text-sm hover:underline">
                        查看当前执业证
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <label className={`border-input hover:bg-accent hover:text-accent-foreground inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors ${isPending ? 'pointer-events-none opacity-50' : ''}`}>
                      <Upload className="size-4" />
                      {licensePdf ? '重新选择' : '选择文件'}
                      <input type="file" accept=".pdf,application/pdf" onChange={handleFileChange} disabled={isPending} className="hidden" />
                    </label>
                    <span className="text-muted-foreground text-sm">支持 PDF 格式，最大 10MB</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={handleCancel} disabled={isPending} className="h-10 min-w-[100px]">
                  <X className="mr-2 size-4" />取消
                </Button>
                <Button type="submit" disabled={isPending} className="h-10 min-w-[100px]">
                  {isPending ? (
                    <><Loader2 className="mr-2 size-4 animate-spin" />保存中...</>
                  ) : (
                    <><Save className="mr-2 size-4" />保存</>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}

export default LawyerForm
