<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'body' => trim((string) $this->input('body')),
        ]);
    }

    public function rules(): array
    {
        return [
            'recipient_id' => [
                'required_without:recipient_ids',
                'nullable',
                'integer',
                'exists:users,id',
                Rule::notIn([$this->user()->id]),
            ],
            'recipient_ids' => [
                'required_without:recipient_id',
                'nullable',
                'array',
                'min:1',
                'max:50',
            ],
            'recipient_ids.*' => [
                'integer',
                'distinct',
                'exists:users,id',
                Rule::notIn([$this->user()->id]),
            ],
            'body' => ['required', 'string', 'max:5000'],
            'attachments' => ['nullable', 'array', 'max:5'],
            'attachments.*' => [
                'file',
                'max:10240',
                'mimes:jpg,jpeg,png,gif,webp,pdf,doc,docx,xls,xlsx,csv,txt,ppt,pptx',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'recipient_id.not_in' => 'You cannot send a message to yourself.',
            'recipient_ids.required_without' => 'Please select at least one recipient.',
            'recipient_ids.min' => 'Please select at least one recipient.',
            'recipient_ids.max' => 'You may send a message to up to 50 recipients at once.',
            'recipient_ids.*.distinct' => 'Each recipient may only be selected once.',
            'recipient_ids.*.not_in' => 'You cannot send a message to yourself.',
            'body.required' => 'Please enter a message.',
            'body.max' => 'Messages may not be longer than 5,000 characters.',
            'attachments.max' => 'You may attach up to 5 files to a message.',
            'attachments.*.max' => 'Each attachment may not be larger than 10 MB.',
            'attachments.*.mimes' => 'Attachments must be an image, PDF, Office document, CSV, or text file.',
        ];
    }
}
