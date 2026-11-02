import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Clock3,
  Info,
  MapPin,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import { useAuth, useAuthToken } from '../../context/AuthContext';
import { api, errorMessage } from '../../lib/api';
import { BLOOD_GROUPS, PRIORITIES } from '../../types/api';
import { bloodGroupOptions, emergencyNotice, matchingNotice, priorityOptions } from '../../lib/constants';
import { defaultNeededBy } from '../../lib/format';
import { invalidateWorkspace } from '../../lib/invalidate';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, SectionCard } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Checkbox, Field, FormError, Input, Select, Textarea } from '../../components/ui/Field';

const requestSchema = z
  .object({
    bloodGroup: z.enum(BLOOD_GROUPS),
    unitsRequested: z
      .number({ error: 'Enter a whole number of units.' })
      .int('Units must be a whole number.')
      .min(1, 'Request at least 1 unit.')
      .max(20, 'This application accepts at most 20 units per request.'),
    hospitalName: z
      .string()
      .trim()
      .min(2, 'Enter the hospital name.')
      .max(160, 'Hospital name must be at most 160 characters.'),
    hospitalCity: z.string().trim().min(2, 'Enter the hospital city.').max(100, 'City is too long.'),
    hospitalArea: z.string().trim().min(2, 'Enter the hospital area.').max(120, 'Area is too long.'),
    neededBy: z
      .string()
      .min(1, 'Choose when the blood is needed.')
      .refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date and time.')
      .refine(
        (value) => Date.parse(value) > Date.now() + 5 * 60 * 1000,
        'Choose a time at least five minutes in the future.',
      ),
    priority: z.enum(PRIORITIES),
    publicMessage: z.string().max(500, 'Keep the message under 500 characters.').optional(),
    contactPhone: z
      .string()
      .trim()
      .regex(/^\+?[0-9][0-9\s\-()]{6,19}$/, 'Enter a valid phone number (7–20 digits, optional +).'),
    contactShareConsent: z.literal(true, {
      error: 'Confirm that your contact may be shared with accepted donors.',
    }),
    accuracyConfirmed: z.literal(true, {
      error: 'Confirm that the information is accurate.',
    }),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    const hasLat = Boolean(values.latitude?.trim());
    const hasLng = Boolean(values.longitude?.trim());
    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: 'custom',
        path: hasLat ? ['longitude'] : ['latitude'],
        message: 'Provide both coordinates, or leave both blank.',
      });
    }
    if (hasLat && hasLng) {
      const lat = Number(values.latitude);
      const lng = Number(values.longitude);
      if (Number.isNaN(lat) || lat < -90 || lat > 90) {
        ctx.addIssue({ code: 'custom', path: ['latitude'], message: 'Latitude must be between -90 and 90.' });
      }
      if (Number.isNaN(lng) || lng < -180 || lng > 180) {
        ctx.addIssue({ code: 'custom', path: ['longitude'], message: 'Longitude must be between -180 and 180.' });
      }
    }
  });

type RequestForm = z.infer<typeof requestSchema>;

export function NewRequestPage() {
  const token = useAuthToken();
  const { me } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  if (!me) return null;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RequestForm>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      bloodGroup: me.donorProfile?.bloodGroup ?? 'O+',
      unitsRequested: 1,
      hospitalName: '',
      hospitalCity: me.profile.city ?? '',
      hospitalArea: me.profile.area ?? '',
      neededBy: defaultNeededBy(),
      priority: 'URGENT',
      publicMessage: '',
      contactPhone: me.profile.phoneNumber ?? '',
      contactShareConsent: false as unknown as true,
      accuracyConfirmed: false as unknown as true,
      latitude: '',
      longitude: '',
    },
  });

  const createRequest = useMutation({
    mutationFn: (input: Parameters<typeof api.createRequest>[1]) => api.createRequest(token, input),
    onSuccess: async (request) => {
      toast.success('Request submitted', 'A hospital verifier can now review it.');
      await invalidateWorkspace(queryClient);
      navigate(`/app/requests/${request.id}`, { replace: true });
    },
    onError: (error) => {
      const message = errorMessage(error);
      setFormError(message);
      toast.error('Could not submit request', message);
    },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    createRequest.mutate({
      bloodGroup: values.bloodGroup,
      unitsRequested: values.unitsRequested,
      hospitalName: values.hospitalName,
      hospitalCity: values.hospitalCity,
      hospitalArea: values.hospitalArea,
      neededBy: new Date(values.neededBy).toISOString(),
      priority: values.priority,
      publicMessage: values.publicMessage?.trim() ? values.publicMessage.trim() : null,
      contactPhone: values.contactPhone,
      contactShareConsent: true,
      accuracyConfirmed: true,
      latitude: values.latitude?.trim() ? Number(values.latitude) : null,
      longitude: values.longitude?.trim() ? Number(values.longitude) : null,
    });
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Requester"
        title="Create a blood request"
        description="Record an accurate need. A hospital verifier must review it before it enters the donor feed."
        actions={
          <Link to="/app/my-requests" className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-600 hover:text-ink-900">
            Back to my requests
          </Link>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)]">
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {formError ? <FormError>{formError}</FormError> : null}

          <SectionCard
            title="Clinical need"
            description="Use the exact blood group and the number of units requested by the treating hospital."
            bodyClassName="space-y-5"
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Blood group" htmlFor="bloodGroup" required error={errors.bloodGroup?.message}>
                <Select id="bloodGroup" invalid={Boolean(errors.bloodGroup)} {...register('bloodGroup')}>
                  {bloodGroupOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Units requested"
                htmlFor="unitsRequested"
                required
                error={errors.unitsRequested?.message}
              >
                <Input
                  id="unitsRequested"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={20}
                  invalid={Boolean(errors.unitsRequested)}
                  {...register('unitsRequested', { valueAsNumber: true })}
                />
              </Field>
              <Field label="Priority" htmlFor="priority" required error={errors.priority?.message}>
                <Select id="priority" invalid={Boolean(errors.priority)} {...register('priority')}>
                  {priorityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field
              label="Needed by"
              htmlFor="neededBy"
              required
              error={errors.neededBy?.message}
              hint="At least five minutes in the future. Expired requests are closed automatically."
            >
              <Input
                id="neededBy"
                type="datetime-local"
                invalid={Boolean(errors.neededBy)}
                {...register('neededBy')}
              />
            </Field>

            <Field
              label="Message for donors"
              htmlFor="publicMessage"
              optional
              error={errors.publicMessage?.message}
              hint="500 characters maximum. Do not include patient names or medical records."
            >
              <Textarea
                id="publicMessage"
                placeholder="Share only the coordination detail donors need. Do not include patient identifiers."
                invalid={Boolean(errors.publicMessage)}
                maxLength={500}
                {...register('publicMessage')}
              />
            </Field>
          </SectionCard>

          <SectionCard
            title="Hospital and location"
            description="The hospital name and general area are shown to matched donors. Exact coordinates, if provided, are used only for consented distance ranking."
            bodyClassName="space-y-5"
          >
            <Field label="Hospital name" htmlFor="hospitalName" required error={errors.hospitalName?.message}>
              <Input
                id="hospitalName"
                placeholder="e.g. City General Hospital"
                invalid={Boolean(errors.hospitalName)}
                {...register('hospitalName')}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Hospital city" htmlFor="hospitalCity" required error={errors.hospitalCity?.message}>
                <Input
                  id="hospitalCity"
                  placeholder="e.g. Pune"
                  invalid={Boolean(errors.hospitalCity)}
                  {...register('hospitalCity')}
                />
              </Field>
              <Field label="Hospital area" htmlFor="hospitalArea" required error={errors.hospitalArea?.message}>
                <Input
                  id="hospitalArea"
                  placeholder="e.g. Shivajinagar"
                  invalid={Boolean(errors.hospitalArea)}
                  {...register('hospitalArea')}
                />
              </Field>
            </div>

            <details className="rounded-xl border border-ink-200 bg-ink-50/60 p-4">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-ink-800">
                Optional approximate hospital coordinates
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-ink-500">
                Coordinates improve distance ranking for donors who consented to share approximate
                location. They are never shown to other users. Provide both or neither.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label="Latitude" htmlFor="latitude" error={errors.latitude?.message}>
                  <Input
                    id="latitude"
                    inputMode="decimal"
                    placeholder="e.g. 18.5204"
                    invalid={Boolean(errors.latitude)}
                    {...register('latitude')}
                  />
                </Field>
                <Field label="Longitude" htmlFor="longitude" error={errors.longitude?.message}>
                  <Input
                    id="longitude"
                    inputMode="decimal"
                    placeholder="e.g. 73.8567"
                    invalid={Boolean(errors.longitude)}
                    {...register('longitude')}
                  />
                </Field>
              </div>
            </details>
          </SectionCard>

          <SectionCard
            title="Requester contact and consent"
            description="Your phone number is hidden from the donor feed. It is shared with an accepted donor only when you consent below."
            bodyClassName="space-y-5"
          >
            <Field
              label="Contact phone"
              htmlFor="contactPhone"
              required
              error={errors.contactPhone?.message}
              hint="Used by an accepted donor or reviewing hospital to coordinate."
            >
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
                <Input
                  id="contactPhone"
                  className="pl-9"
                  inputMode="tel"
                  autoComplete="tel"
                  invalid={Boolean(errors.contactPhone)}
                  {...register('contactPhone')}
                />
              </div>
            </Field>

            <Checkbox
              id="contactShareConsent"
              label="I consent to my phone number being shared with a donor whose offer I accept."
              description="Contact is shared only after acceptance. It is never included in public listings or the donor feed."
              {...register('contactShareConsent')}
            />
            {errors.contactShareConsent?.message ? (
              <p className="text-xs font-medium text-brand-accent" role="alert">
                {errors.contactShareConsent.message}
              </p>
            ) : null}

            <Checkbox
              id="accuracyConfirmed"
              label="I confirm that this request is accurate and submitted in good faith."
              description="Knowingly false requests may be cancelled and your account reviewed by an administrator."
              {...register('accuracyConfirmed')}
            />
            {errors.accuracyConfirmed?.message ? (
              <p className="text-xs font-medium text-brand-accent" role="alert">
                {errors.accuracyConfirmed.message}
              </p>
            ) : null}
          </SectionCard>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link to="/app/my-requests" className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-ink-500 hover:text-ink-800">
              Cancel
            </Link>
            <Button
              type="submit"
              size="lg"
              isLoading={isSubmitting || createRequest.isPending}
              rightIcon={<ArrowRight className="size-4" aria-hidden="true" />}
            >
              Submit request for review
            </Button>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-inverse p-5 text-white shadow-card sm:p-6">
            <span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-brand-300">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-base font-semibold text-white">What happens next</h2>
            <ol className="mt-3 space-y-3 text-sm text-white/65">
              <li className="flex gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">1</span>
                An approved hospital verifier reviews hospital, blood group and deadline details.
              </li>
              <li className="flex gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">2</span>
                Verified requests appear to available donors with the exact recorded blood group.
              </li>
              <li className="flex gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">3</span>
                You accept or decline offers. Contact details are exchanged only on consent.
              </li>
              <li className="flex gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">4</span>
                Record completion after hospital procedures. It is not medical proof of donation.
              </li>
            </ol>
          </div>

          <Alert variant="info" title="Matching scope">
            {matchingNotice}
          </Alert>

          <Alert variant="warning" title="Emergency?">
            {emergencyNotice}
          </Alert>

          <Card>
            <h2 className="text-sm font-semibold text-ink-900">Privacy reminders</h2>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-ink-600">
              <li className="flex gap-2">
                <Info className="mt-0.5 size-3.5 shrink-0 text-ink-500" aria-hidden="true" />
                Do not include patient names, diagnoses or record numbers in the public message.
              </li>
              <li className="flex gap-2">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-ink-500" aria-hidden="true" />
                Only the hospital area and city are shown to matched donors.
              </li>
              <li className="flex gap-2">
                <Clock3 className="mt-0.5 size-3.5 shrink-0 text-ink-500" aria-hidden="true" />
                Requests expire automatically when the required-by time passes.
              </li>
              <li className="flex gap-2">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-ink-500" aria-hidden="true" />
                You can cancel before fulfilment if blood is no longer needed.
              </li>
            </ul>
          </Card>

          <Card className="flex items-start gap-3">
            <Building2 className="mt-0.5 size-5 shrink-0 text-ink-500" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-ink-500">
              Hospital review decisions are recorded in the application database. If the deployment
              enables the audit layer, an authorized wallet may add an on-chain anchor. That anchor
              never replaces clinical checks.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
